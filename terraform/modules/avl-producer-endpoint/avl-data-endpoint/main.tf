terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_endpoint_s3_bucket" {
  bucket = "integrated-data-siri-vm-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_endpoint_s3_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_endpoint_s3_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "integrated_data_bods_avl_data_endpoint_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-avl-data-endpoint"
  zip_path      = "${path.module}/../../../src/functions/dist/avl-data-endpoint.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 3072

  permissions = [
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "integrated-data-siri-vm-${var.environment}/*"
      ]
    }
  ]

}
