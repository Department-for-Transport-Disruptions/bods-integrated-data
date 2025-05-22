terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_bods_fares_zipped_bucket" {
  bucket = "integrated-data-bods-fares-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_bods_fares_bucket" {
  bucket = "integrated-data-bods-fares-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_fares_zipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_fares_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_fares_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_fares_bucket.bucket

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_bods_fares_zipped_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_bods_fares_zipped_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "integrated_data_bods_fares_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-fares-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/bods-fares-retriever.zip"
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
      "${aws_s3_bucket.integrated_data_bods_fares_zipped_bucket.arn}/*"
    ]
  }]

  env_vars = {
    STAGE                    = var.environment
    FARES_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_fares_zipped_bucket.bucket
  }
}

module "integrated_data_bods_fares_unzipper_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-fares-unzipper"
  zip_path      = "${path.module}/../../../../src/functions/dist/bods-fares-unzipper.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 1024

  permissions = [
    {
      Action = [
        "s3:GetObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_fares_zipped_bucket.arn}/*",
      ]
    },
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_fares_bucket.arn}/*",
      ]
    },
  ]

  env_vars = {
    STAGE                      = var.environment
    UNZIPPED_FARES_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_fares_bucket.id
  }
}
