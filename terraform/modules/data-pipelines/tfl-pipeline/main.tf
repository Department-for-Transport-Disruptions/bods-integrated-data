terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_tfl_timetables_bucket" {
  bucket = "integrated-data-tfl-timetables-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tfl_timetables_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetables_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "integrated_data_tfl_timetable_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tfl-timetable-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/tfl-timetable-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory        = 512

  permissions = [
    {
      Action = [
        "s3:GetObject",
        "s3:ListObject",
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_tfl_timetables_bucket.arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE                      = var.environment
    TFL_TIMETABLES_BUCKET_NAME = aws_s3_bucket.integrated_data_tfl_timetables_bucket.bucket
  }
}
