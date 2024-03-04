terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_security_group" "avl_aggregate_siri_sg" {
  name   = "integrated-data-db-migrator-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "avl_aggregate_siri_sg_allow_all_egress_ipv4" {
  security_group_id = aws_security_group.avl_aggregate_siri_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "avl_aggregate_siri_sg_allow_all_egress_ipv6" {
  security_group_id = aws_security_group.avl_aggregate_siri_sg.id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "avl_aggregate_siri_sg_allow_lambda_ingress" {
  security_group_id            = var.db_sg_id
  referenced_security_group_id = aws_security_group.avl_aggregate_siri_sg.id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

resource "aws_cloudwatch_log_group" "lambda_aggregate_siri_logging_group" {
  name = "/aws/lambda/${local.lambda_name}"
}

resource "aws_iam_policy" "lambda_aggregate_siri_policy" {
  name = "avl-lambda-aggregate-siri-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": ["${aws_cloudwatch_log_group.lambda_aggregate_siri_logging_group.arn}:*"],
        "Effect": "Allow"
      },
    ]
  })
}

resource "aws_iam_role" "avl_aggregate_siri_role" {
  name               = "avl-lambda-aggregate-siri-role-${var.environment}"
  managed_policy_arns = [aws_iam_policy.lambda_aggregate_siri_policy.arn]
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "lambda.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_s3_bucket" "siri_vm_bucket" {
  bucket = "avl-siri-vm-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "siri_vm_block_public" {
  bucket = aws_s3_bucket.siri_vm_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "versioning_example" {
  bucket = aws_s3_bucket.siri_vm_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "avl_aggregate_siri" {
  source = "../../shared/lambda-function"

  function_name      = local.lambda_name
  zip_path           = "${path.module}/../../../../src/functions/dist/transform-siri.zip"
  handler            = "functions/transform-siri/index.handler"
  memory             = 1024
  role_arn           = aws_iam_role.avl_aggregate_siri_role.arn
  runtime            = "nodejs20.x"
  timeout            = 120
  subnet_ids         = var.private_subnet_ids
  security_group_ids = [aws_security_group.avl_aggregate_siri_sg.arn]
  schedule           = "rate(10 seconds)"

  env_vars = {
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
    BUCKET_NAME = aws_s3_bucket.siri_vm_bucket.bucket
    }
}

locals {
  lambda_name = "avl-aggregate-siri-${var.environment}"
}