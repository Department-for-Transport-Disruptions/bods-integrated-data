terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_tfl_timetable_zipped_bucket" {
  bucket = "integrated-data-tfl-timetable-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_tfl_timetable_bucket" {
  bucket = "integrated-data-tfl-timetable-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tfl_timetable_zipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tfl_timetable_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_tfl_timetable_zipped_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.id
  rule {
    id = "config"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_tfl_timetable_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_bucket.id
  rule {
    id = "config"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }
    status = "Enabled"
  }
}

module "integrated_data_tfl_timetable_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tfl-timetable-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/tfl-timetable-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 600
  memory        = 512

  permissions = [
    {
      Action = [
        "s3:ListBucket",
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.arn,
        "${aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.arn}/*"
      ]
    },
    {
      Action = [
        "s3:GetObject",
        "s3:ListBucket",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::ibus.data.tfl.gov.uk",
        "arn:aws:s3:::ibus.data.tfl.gov.uk/*"
      ]
    }
  ]

  env_vars = {
    STAGE                            = var.environment
    TFL_TIMETABLE_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.bucket
  }
}

module "integrated_data_tfl_timetable_unzipper_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tfl-timetable-unzipper"
  zip_path      = "${path.module}/../../../../src/functions/dist/tfl-timetable-unzipper.zip"
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
        "${aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.arn}/*",
      ]
    },
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_tfl_timetable_bucket.arn}/*",
      ]
    },
  ]

  env_vars = {
    STAGE                = var.environment
    UNZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_tfl_timetable_bucket.id
  }
}

module "integrated_data_tfl_timetable_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-tfl-timetable-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/tfl-timetable-processor.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
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
        "${aws_s3_bucket.integrated_data_tfl_timetable_bucket.arn}/*"
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
    },
  ]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}
