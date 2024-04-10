terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
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

module "integrated_data_gtfs_rt_processor_function" {
  source = "../../shared/lambda-function"

  environment    = var.environment
  function_name  = "integrated-data-gtfs-rt-generator"
  zip_path       = "${path.module}/../../../../src/functions/dist/gtfs-rt-generator.zip"
  handler        = "index.handler"
  runtime        = "nodejs20.x"
  timeout        = 60
  memory         = 512
  vpc_id         = var.vpc_id
  subnet_ids     = var.private_subnet_ids
  database_sg_id = var.db_sg_id
  schedule       = var.environment == "dev" ? "rate(1 minute)" : "rate(10 seconds)"

  permissions = [{
    Action = [
      "s3:PutObject",
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
  }, ]

  env_vars = {
    BUCKET_NAME   = aws_s3_bucket.integrated_data_gtfs_rt_bucket.bucket
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}
