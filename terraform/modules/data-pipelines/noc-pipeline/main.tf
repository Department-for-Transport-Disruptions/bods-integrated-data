terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_noc_bucket" {
  bucket = "integrated-data-noc-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_noc_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_noc_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_noc_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_noc_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "integrated_data_noc_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-noc-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/noc-retriever.zip"
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
      "${aws_s3_bucket.integrated_data_noc_bucket.arn}/*"
    ]
  }]

  env_vars = {
    STAGE           = var.environment
    NOC_BUCKET_NAME = aws_s3_bucket.integrated_data_noc_bucket.bucket
  }
}

module "integrated_data_noc_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-noc-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/noc-processor.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 200
  memory          = 2048
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [{
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      var.db_secret_arn,
    ]
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_noc_bucket.arn}/*"
      ]
  }]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}
