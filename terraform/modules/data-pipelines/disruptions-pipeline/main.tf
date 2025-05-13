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

resource "aws_s3_bucket" "integrated_data_bods_disruptions_gtfs_rt_bucket" {
  bucket = "integrated-data-bods-disruptions-gtfs-rt-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_disruptions_gtfs_rt_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_disruptions_gtfs_rt_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_bods_disruptions_gtfs_rt_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_bods_disruptions_gtfs_rt_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_bods_disruptions_gtfs_rt_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_bods_disruptions_gtfs_rt_bucket.id
  rule {
    id = "config"
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
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
  timeout       = 60
  memory        = 256
  schedule      = var.retriever_schedule

  permissions = [
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE                            = var.environment
    DISRUPTIONS_UNZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.bucket
  }
}

module "integrated_data_bods_disruptions_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-bods-disruptions-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/bods-disruptions-processor.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 60
  memory          = 1024
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id
  s3_bucket_trigger = {
    id  = aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.id
    arn = aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.arn
  }

  permissions = [
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn,
      ]
      }, {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.arn}/*"
      ]
      }, {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_disruptions_gtfs_rt_bucket.arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
    BUCKET_NAME   = aws_s3_bucket.integrated_data_bods_disruptions_gtfs_rt_bucket.bucket
    SAVE_JSON     = var.save_json ? "true" : "false"
  }
}
