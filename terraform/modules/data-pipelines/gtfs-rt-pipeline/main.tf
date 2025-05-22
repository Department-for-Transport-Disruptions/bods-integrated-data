terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_gtfs_rt_bucket" {
  bucket = "integrated-data-gtfs-rt-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_gtfs_rt_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_gtfs_rt_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_gtfs_rt_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_gtfs_rt_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_gtfs_rt_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_gtfs_rt_bucket.id
  rule {
    id = "config"

    filter {
      prefix = ""
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    status = "Enabled"
  }
}

module "integrated_data_gtfs_rt_downloader_function" {
  source = "../../shared/lambda-function"

  environment       = var.environment
  function_name     = "integrated-data-gtfs-rt-downloader"
  zip_path          = "${path.module}/../../../../src/functions/dist/gtfs-rt-downloader.zip"
  handler           = "index.handler"
  runtime           = "nodejs20.x"
  timeout           = 120
  memory            = 1024
  ephemeral_storage = 5120
  needs_db_access   = var.environment != "local"
  vpc_id            = var.vpc_id
  subnet_ids        = var.private_subnet_ids
  database_sg_id    = var.db_sg_id

  permissions = [
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_gtfs_rt_bucket.arn}/*"
      ]
      }, {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn,
      ]
      }, {
      Action = [
        "cloudwatch:PutMetricData",
      ],
      Effect   = "Allow",
      Resource = "*"
    }
  ]

  env_vars = {
    STAGE                = var.environment
    BUCKET_NAME          = aws_s3_bucket.integrated_data_gtfs_rt_bucket.bucket
    DB_HOST              = var.db_reader_host
    DB_PORT              = var.db_port
    DB_SECRET_ARN        = var.db_secret_arn
    DB_NAME              = var.db_name
    ENABLE_CANCELLATIONS = var.enable_cancellations ? "true" : "false"
  }
}

module "integrated_data_gtfs_rt_service_alerts_downloader_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-gtfs-rt-service-alerts-downloader"
  zip_path        = "${path.module}/../../../../src/functions/dist/gtfs-rt-service-alerts-downloader.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 120
  memory          = 1024
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
        "${var.gtfs_rt_service_alerts_bucket_arn}/*"
      ]
    },
  ]

  env_vars = {
    STAGE       = var.environment
    BUCKET_NAME = var.gtfs_rt_service_alerts_bucket_name
  }
}

resource "aws_lambda_function_url" "gtfs_rt_download_url" {
  count = var.environment == "local" ? 1 : 0

  function_name      = module.integrated_data_gtfs_rt_downloader_function.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_function_url" "gtfs_rt_service_alerts_download_url" {
  count = var.environment == "local" ? 1 : 0

  function_name      = module.integrated_data_gtfs_rt_service_alerts_downloader_function.function_name
  authorization_type = "NONE"
}
