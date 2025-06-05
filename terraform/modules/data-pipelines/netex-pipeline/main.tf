terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_netex_zipped_bucket" {
  bucket = "integrated-data-netex-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_netex_bucket" {
  bucket = "integrated-data-netex-${var.environment}"
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_netex_zipped_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_netex_zipped_bucket.id
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

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_netex_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_netex_bucket.id
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

resource "aws_s3_bucket_public_access_block" "integrated_data_netex_zipped_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_netex_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_netex_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_netex_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_netex_zipped_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_netex_zipped_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "integrated_data_netex_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_netex_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "integrated_data_netex_retriever_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-netex-retriever"
  zip_path        = "${path.module}/../../../../src/functions/dist/netex-retriever.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 600
  memory          = 2048
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_netex_bucket.arn}/*",
        "${aws_s3_bucket.integrated_data_netex_zipped_bucket.arn}/*"
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
    STAGE              = var.environment
    BUCKET_NAME        = aws_s3_bucket.integrated_data_netex_bucket.bucket
    ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_netex_zipped_bucket.bucket
    DB_HOST            = var.db_host
    DB_PORT            = var.db_port
    DB_SECRET_ARN      = var.db_secret_arn
    DB_NAME            = var.db_name
  }
}

module "integrated_data_netex_unzipper_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-netex-unzipper"
  zip_path      = "${path.module}/../../../../src/functions/dist/netex-unzipper.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 256

  permissions = [
    {
      Action = [
        "s3:GetObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_netex_zipped_bucket.arn}/*",
      ]
    },
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_netex_bucket.arn}/*",
      ]
    },
  ]

  env_vars = {
    STAGE                = var.environment
    UNZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_netex_bucket.id
  }
}
