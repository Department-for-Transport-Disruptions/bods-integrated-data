terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_lambda_function_url" "gtfs_download_url" {
  count = var.environment == "local" ? 1 : 0

  function_name      = module.integrated_data_gtfs_downloader_function.function_name
  authorization_type = "NONE"
}

module "integrated_data_gtfs_downloader_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-gtfs-downloader"
  zip_path      = "${path.module}/../../../src/functions/dist/gtfs-downloader.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 1024

  permissions = [
    {
      Action = [
        "s3:GetObject",
      ],
      Effect   = "Allow",
      Resource = [
        "arn:aws:s3:::${var.gtfs_bucket_name}/*"
      ]
    },
  ]

  env_vars = {
    STAGE       = var.environment
    BUCKET_NAME = var.gtfs_bucket_name
  }
}

module "integrated_data_gtfs_region_retriever_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-gtfs-region-retriever"
  zip_path      = "${path.module}/../../../src/functions/dist/gtfs-timetables-region-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 512

  permissions = [
    {
      Action = [
        "s3:ListObjects",
      ],
      Effect   = "Allow",
      Resource = [
        "arn:aws:s3:::${var.gtfs_bucket_name}/*"
      ]
    },
  ]

  env_vars = {
    STAGE       = var.environment
    BUCKET_NAME = var.gtfs_bucket_name
  }
}