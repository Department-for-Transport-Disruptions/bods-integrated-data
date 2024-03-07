terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_bods_txc_zipped_bucket" {
  bucket = "integrated-data-bods-txc-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_tnds_txc_zipped_bucket" {
  bucket = "integrated-data-tnds-txc-zipped-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_txc_zipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tnds_txc_zipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "integrated_data_bods_txc_bucket" {
  bucket = "integrated-data-bods-txc-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_tnds_txc_bucket" {
  bucket = "integrated-data-tnds-txc-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_txc_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_txc_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tnds_txc_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tnds_txc_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "integrated_data_bods_txc_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-txc-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/bods-txc-retriever.zip"
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
      "${aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.arn}/*"
    ]
  }]

  env_vars = {
    TXC_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.bucket
  }
}

module "integrated_data_tnds_txc_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-txc-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/tnds-txc-retriever.zip"
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
      "${aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.arn}/*"
    ]
  }]

  env_vars = {
    TXC_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.bucket
    TNDS_FTP_ARN           = var.tnds_ftp_arn
  }
}

module "integrated_data_txc_retriever_function" {
  source = "../../shared/lambda-function"

  environment    = var.environment
  function_name  = "integrated-data-txc-retriever"
  zip_path       = "${path.module}/../../../../src/functions/dist/txc-retriever.zip"
  handler        = "index.handler"
  runtime        = "nodejs20.x"
  timeout        = 60
  memory         = 1024
  vpc_id         = var.vpc_id
  subnet_ids     = var.private_subnet_ids
  database_sg_id = var.db_sg_id
  schedule       = "cron(30 2 * * ? *)"

  permissions = [{
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      var.db_secret_arn,
      var.tnds_ftp_arn
    ]
    },
    {
      Action = ["lambda:invokeAsync", "lambda:invokeFunction"],
      Effect = "Allow",
      Resource = [
        module.integrated_data_bods_txc_retriever_function.function_arn
      ]
  }]

  env_vars = {
    BODS_TXC_RETRIEVER_FUNCTION_NAME = module.integrated_data_bods_txc_retriever_function.function_name
    TNDS_TXC_RETRIEVER_FUNCTION_NAME = module.integrated_data_tnds_txc_retriever_function.function_name
    DB_HOST                          = var.db_host
    DB_PORT                          = var.db_port
    DB_SECRET_ARN                    = var.db_secret_arn
    DB_NAME                          = var.db_name
  }
}

module "integrated_data_bods_txc_unzipper_function" {
  source = "../../unzipper"

  environment          = var.environment
  unzipped_bucket_arn  = aws_s3_bucket.integrated_data_bods_txc_bucket.arn
  unzipped_bucket_name = aws_s3_bucket.integrated_data_bods_txc_bucket.bucket
  zipped_bucket_arn    = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.arn
  zipped_bucket_name   = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.bucket
}

module "integrated_data_tnds_txc_unzipper_function" {
  source = "../../unzipper"

  environment          = var.environment
  unzipped_bucket_arn  = aws_s3_bucket.integrated_data_tnds_txc_bucket.arn
  unzipped_bucket_name = aws_s3_bucket.integrated_data_tnds_txc_bucket.bucket
  zipped_bucket_arn    = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.arn
  zipped_bucket_name   = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.bucket
}
