terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_gtfs_bucket" {
  bucket = "gtfs-${var.environment}"
}

resource "aws_lambda_function_url" "gtfs_download_url" {
  function_name      = module.integrated_data_gtfs_downloader_function.function_name
  authorization_type = "NONE"
}

module "integrated_data_gtfs_downloader_function" {
  source = "../shared/lambda-function"

  environment = var.environment
  function_name = "integrated_data_gtfs_downloader"
  zip_path = "${path.module}/../../../src/functions/dist/gtfs-downloader.zip"
  handler = "index.handler"
  runtime = "nodejs20.x"
  timeout = 120
  memory = 1024

  env_vars = {
    BUCKET_NAME = aws_s3_bucket.integrated_data_gtfs_bucket.bucket
  }

  permissions = [
    {
      Action = [
        "s3:GetObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_gtfs_bucket.arn}/gtfs.zip"
      ]
    },
  ]
}
