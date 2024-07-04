terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_avl_archive_bucket" {
  bucket = "integrated-data-avl-archive-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_avl_archive_block_public" {
  bucket = aws_s3_bucket.integrated_data_avl_archive_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_avl_archive_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_avl_archive_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket" "integrated_data_txc_archive_bucket" {
  bucket = "integrated-data-txc-archive-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_txc_archive_block_public" {
  bucket = aws_s3_bucket.integrated_data_txc_archive_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_txc_archive_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_txc_archive_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}
