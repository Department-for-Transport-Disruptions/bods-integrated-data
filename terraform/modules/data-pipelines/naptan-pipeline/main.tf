terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_naptan_s3_bucket" {
  bucket = "integrated-data-naptan-stops-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_naptan_s3_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_naptan_s3_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_naptan_s3_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_naptan_s3_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "integrated_data_naptan_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-naptan-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/naptan-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 2048

  permissions = [
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_naptan_s3_bucket.arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE       = var.environment
    BUCKET_NAME = aws_s3_bucket.integrated_data_naptan_s3_bucket.bucket
  }
}

module "integrated_data_naptan_uploader_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-naptan-uploader"
  zip_path        = "${path.module}/../../../../src/functions/dist/naptan-uploader.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
  memory          = 3072
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_naptan_s3_bucket.arn}/*"
      ]
    },
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn
      ]
    }
  ]

  env_vars = {
    STAGE         = var.environment
    BUCKET_NAME   = aws_s3_bucket.integrated_data_naptan_s3_bucket.bucket
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}
