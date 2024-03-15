terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_db_subnet_group" "rds_private_db_subnet" {
  name        = "integrated-data-db-subnet-group-${var.environment}"
  description = "DB subnets for RDS instance"
  subnet_ids  = var.db_subnet_ids
}

resource "aws_security_group" "integrated_data_db_sg" {
  name   = "integrated-data-db-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_db_sg_self_ingress" {
  security_group_id            = aws_security_group.integrated_data_db_sg.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.integrated_data_db_sg.id
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_db_sg_self_egress" {
  security_group_id            = aws_security_group.integrated_data_db_sg.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.integrated_data_db_sg.id
}

resource "aws_rds_cluster" "integrated_data_rds_cluster" {
  engine                      = "aurora-postgresql"
  engine_version              = "16.1"
  engine_mode                 = "provisioned"
  master_username             = "postgres"
  manage_master_user_password = true
  cluster_identifier          = "integrated-data-rds-db-cluster-${var.environment}"
  vpc_security_group_ids      = [aws_security_group.integrated_data_db_sg.id]
  db_subnet_group_name        = aws_db_subnet_group.rds_private_db_subnet.id
  storage_encrypted           = true
  deletion_protection         = var.enable_deletion_protection
  final_snapshot_identifier   = "integrated-data-rds-db-cluster-final-snapshot-${var.environment}"
  database_name               = "bods_integrated_data"

  serverlessv2_scaling_configuration {
    max_capacity = var.max_db_capacity
    min_capacity = var.min_db_capacity
  }
}

resource "aws_rds_cluster_instance" "integrated_data_postgres_db_instance" {
  count                                 = var.multi_az ? 2 : 1
  cluster_identifier                    = aws_rds_cluster.integrated_data_rds_cluster.id
  engine                                = "aurora-postgresql"
  engine_version                        = "16.1"
  instance_class                        = "db.serverless"
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  identifier                            = "integrated-data-rds-db-instance-${count.index + 1}-${var.environment}"
}

resource "aws_iam_policy" "rds_proxy_policy" {
  count = var.enable_rds_proxy ? 1 : 0

  name = "integrated-data-rds-proxy-policy-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : "secretsmanager:GetSecretValue",
        "Resource" : [
          aws_rds_cluster.integrated_data_rds_cluster.master_user_secret[0].secret_arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "rds_proxy_role" {
  count = var.enable_rds_proxy ? 1 : 0

  name                = "integrated-data-rds-proxy-role-${var.environment}"
  managed_policy_arns = [aws_iam_policy.rds_proxy_policy[0].arn]

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "rds.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_db_proxy" "integrated_data_rds_proxy" {
  count = var.enable_rds_proxy ? 1 : 0

  name                   = "integrated-data-rds-proxy-${var.environment}"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = false
  role_arn               = aws_iam_role.rds_proxy_role[0].arn
  vpc_security_group_ids = [aws_security_group.integrated_data_db_sg.id]
  vpc_subnet_ids         = var.db_subnet_ids

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_rds_cluster.integrated_data_rds_cluster.master_user_secret[0].secret_arn
  }
}

resource "aws_db_proxy_default_target_group" "integrated_data_rds_proxy_default_target_group" {
  count = var.enable_rds_proxy ? 1 : 0

  db_proxy_name = aws_db_proxy.integrated_data_rds_proxy[0].name

  connection_pool_config {
    max_connections_percent = 100
  }
}

resource "aws_db_proxy_target" "integrated_data_rds_proxy_target" {
  count = var.enable_rds_proxy ? 1 : 0

  db_cluster_identifier = aws_rds_cluster.integrated_data_rds_cluster.id
  db_proxy_name         = aws_db_proxy.integrated_data_rds_proxy[0].name
  target_group_name     = aws_db_proxy_default_target_group.integrated_data_rds_proxy_default_target_group[0].name
}

resource "aws_route53_record" "integrated_data_db_cname_record" {
  zone_id = var.private_hosted_zone_id
  name    = "db.${var.private_hosted_zone_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.enable_rds_proxy ? aws_db_proxy.integrated_data_rds_proxy[0].endpoint : aws_rds_cluster.integrated_data_rds_cluster.endpoint]
}
