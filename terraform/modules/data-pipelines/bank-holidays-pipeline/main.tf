terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_bank_holidays_bucket" {
  bucket = "integrated-data-bank-holidays-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bank_holidays_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bank_holidays_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "integrated_data_bank_holidays_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bank-holidays-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/bank-holidays-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 1024
  schedule      = "cron(0 2 * * ? *)"

  permissions = [{
    Action = [
      "s3:PutObject",
    ],
    Effect = "Allow",
    Resource = [
      "${aws_s3_bucket.integrated_data_bank_holidays_bucket.arn}/*"
    ]
  }]

  env_vars = {
    BANK_HOLIDAYS_BUCKET_NAME = aws_s3_bucket.integrated_data_bank_holidays_bucket.bucket
  }
}