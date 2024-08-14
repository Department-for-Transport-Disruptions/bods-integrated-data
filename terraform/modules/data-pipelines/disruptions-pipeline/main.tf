terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_bods_disruptions_unzipped_bucket" {
  bucket = "integrated-data-bods-disruptions-unzipped-${var.environment}"
}


resource "aws_s3_bucket_public_access_block" "integrated_data_bods_disruptions_unzipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_bods_disruptions_unzipped_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "integrated_data_bods_disruptions_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-disruptions-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/bods-disruptions-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 1024

  permissions = [{
    Action = [
      "s3:PutObject",
    ],
    Effect = "Allow",
    Resource = [
      "${aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.arn}/*"
    ]
  }]

  env_vars = {
    STAGE                            = var.environment
    DISRUPTIONS_UNZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.bucket
  }
}
