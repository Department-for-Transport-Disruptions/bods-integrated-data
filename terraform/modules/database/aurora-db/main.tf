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

resource "aws_route53_record" "integrated_data_db_cname_record" {
  zone_id = var.private_hosted_zone_id
  name    = "db.${var.private_hosted_zone_name}"
  type    = "CNAME"
  ttl     = 300
  records = [aws_rds_cluster.integrated_data_rds_cluster.endpoint]
}
