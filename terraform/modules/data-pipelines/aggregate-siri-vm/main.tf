terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_avl_siri_vm_bucket" {
  bucket = "avl-siri-vm-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_avl_siri_vm_block_public" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "versioning_example" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "avl_aggregate_siri" {
  source = "../../shared/lambda-function"

  environment = var.environment
  function_name      = local.lambda_name
  zip_path           = "${path.module}/../../../../src/functions/dist/transform-siri.zip"
  handler            = "index.handler"
  memory             = 1024
  runtime            = "nodejs20.x"
  timeout            = 120
  vpc_id             = var.vpc_id
  subnet_ids         = var.private_subnet_ids
  database_sg_id     = var.db_sg_id
  schedule           = "rate(10 seconds)"

  permissions = [{
    Action = [
      "s3:PutObject",
    ],
    Effect = "Allow",
    Resource = [
      "${aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn}/*"
    ]
  }]

  env_vars = {
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
    BUCKET_NAME = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.bucket
    }

}

locals {
  lambda_name = "avl-aggregate-siri-${var.environment}"
}