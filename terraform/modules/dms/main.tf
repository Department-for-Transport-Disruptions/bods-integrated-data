terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

data "aws_iam_policy_document" "dms_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      identifiers = ["dms.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_role" "dms_access_for_endpoint" {
  assume_role_policy = data.aws_iam_policy_document.dms_assume_role.json
  name               = "dms-access-for-endpoint-${var.environment}"
}

resource "aws_iam_role_policy_attachment" "dms_access_for_endpoint_AmazonDMSRedshiftS3Role" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonDMSRedshiftS3Role"
  role       = aws_iam_role.dms_access_for_endpoint.name
}

resource "aws_iam_role" "dms_cloudwatch_logs_role" {
  assume_role_policy = data.aws_iam_policy_document.dms_assume_role.json
  name               = "dms-cloudwatch-logs-role-${var.environment}"
}

resource "aws_iam_role_policy_attachment" "dms_cloudwatch_logs_role_AmazonDMSCloudWatchLogsRole" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonDMSCloudWatchLogsRole"
  role       = aws_iam_role.dms_cloudwatch_logs_role.name
}

resource "aws_iam_role" "dms-vpc-role" {
  assume_role_policy = data.aws_iam_policy_document.dms_assume_role.json
  name               = "dms-vpc-role-${var.environment}"
}

resource "aws_iam_role_policy_attachment" "dms_vpc_role_AmazonDMSVPCManagementRole" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonDMSVPCManagementRole"
  role       = aws_iam_role.dms-vpc-role.name
}

# Create a new replication subnet group
resource "aws_dms_replication_subnet_group" "replication_subnet_group" {
  replication_subnet_group_description = "Replication subnet group for DMS."
  replication_subnet_group_id          = "dms-subnet-group-${var.environment}"
  subnet_ids                           = var.private_subnet_ids
  depends_on                           = [aws_iam_role_policy_attachment.dms_vpc_role_AmazonDMSVPCManagementRole]
}

# Create a new replication instance
resource "aws_dms_replication_instance" "replication_instance" {
  allocated_storage           = 10
  apply_immediately           = true
  availability_zone           = "eu-west-2b"
  publicly_accessible         = true
  replication_instance_class  = "dms.t3.small"
  replication_instance_id     = "cavl-dms-replication-instance-${var.environment}"
  replication_subnet_group_id = aws_dms_replication_subnet_group.replication_subnet_group.id
}

# Create a new replication task
resource "aws_dms_replication_task" "rt-mssql-pg" {
  migration_type           = "full-load-and-cdc"
  replication_instance_arn = aws_dms_replication_instance.replication_instance.replication_instance_arn
  replication_task_id      = "dms-rt-mssql-pg"
  source_endpoint_arn      = aws_dms_s3_endpoint.dms_endpoint_source.endpoint_arn
  target_endpoint_arn      = aws_dms_endpoint.dms-endpoint-target.endpoint_arn
  table_mappings           = "{\"rules\":[{\"rule-type\":\"selection\",\"rule-id\":\"1\",\"rule-name\":\"1\",\"object-locator\":{\"schema-name\":\"%\",\"table-name\":\"%\"},\"rule-action\":\"include\"}]}"
}

resource "aws_iam_policy" "cavl_dms_source_policy" {
  name = "cavl-dms-source-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
        "s3:*"]
        Effect   = "Allow"
        Resource = "*"
      },
    ]
  })
}


data "aws_iam_policy_document" "dms_trust_policy" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["dms.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cavl_dms_source_role" {
  name                = "cavl-dms-source-role-${var.environment}"
  path                = "/"
  assume_role_policy  = data.aws_iam_policy_document.dms_trust_policy.json
  managed_policy_arns = [aws_iam_policy.cavl_dms_source_policy.arn]
}

resource "aws_iam_role" "cavl_dms_target_role" {
  name                = "cavl-dms-target-role-${var.environment}"
  path                = "/"
  assume_role_policy  = data.aws_iam_policy_document.dms_trust_policy.json
  managed_policy_arns = ["arn:aws:iam::aws:policy/SecretsManagerReadWrite"]
}

resource "aws_dms_s3_endpoint" "dms_endpoint_source" {
  endpoint_id               = "dms-endpoint-source-s3-${var.environment}"
  endpoint_type             = "source"
  external_table_definition = file("${path.module}/table_definition.json")
  ssl_mode                  = "none"
  bucket_name               = "cavl-dms-source-${var.environment}"
  cdc_path                  = "cdcpath"
  csv_delimiter             = ";"
  csv_row_delimiter         = "\n"
  service_access_role_arn   = aws_iam_role.cavl_dms_source_role.arn
}

data "aws_secretsmanager_secret" "secretmasterDB" {
  name = "DB-master-pass-tf-${var.environment}"
}

resource "aws_dms_endpoint" "dms-endpoint-target" {
  endpoint_id                     = "dms-endpoint-target-aurora-${var.environment}"
  endpoint_type                   = "target"
  engine_name                     = "aurora-postgresql"
  database_name                   = "cavldb"
  secrets_manager_access_role_arn = aws_iam_role.cavl_dms_target_role.arn
  secrets_manager_arn             = data.aws_secretsmanager_secret.secretmasterDB
}
