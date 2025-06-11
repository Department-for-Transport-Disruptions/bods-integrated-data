terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_bods_netex_zipped_bucket" {
  bucket = "integrated-data-bods-netex-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_bods_netex_bucket" {
  bucket = "integrated-data-bods-netex-${var.environment}"
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_bods_netex_zipped_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_bods_netex_zipped_bucket.id
  rule {
    id = "config"

    filter {
      prefix = ""
    }

    expiration {
      days = 14
    }
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_bods_netex_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_bods_netex_bucket.id
  rule {
    id = "config"

    filter {
      prefix = ""
    }

    expiration {
      days = 14
    }
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_netex_zipped_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_bods_netex_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_netex_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_bods_netex_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "integrated_data_bods_netex_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-netex-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/bods-netex-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 600
  memory        = 2048

  permissions = [
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_netex_bucket.arn}/*",
        "${aws_s3_bucket.integrated_data_bods_netex_zipped_bucket.arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE              = var.environment
    BUCKET_NAME        = aws_s3_bucket.integrated_data_bods_netex_bucket.bucket
    ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_netex_zipped_bucket.bucket
  }
}

module "integrated_data_bods_netex_unzipper_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-netex-unzipper"
  zip_path      = "${path.module}/../../../../src/functions/dist/bods-netex-unzipper.zip"
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 600
  memory        = 2048

  permissions = [
    {
      Action = [
        "s3:GetObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_netex_zipped_bucket.arn}/*",
      ]
    },
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_netex_bucket.arn}/*",
      ]
    },
  ]

  env_vars = {
    STAGE                = var.environment
    UNZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_netex_bucket.id
  }
}
