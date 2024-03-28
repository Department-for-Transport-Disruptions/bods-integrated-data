terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
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
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::${var.gtfs_bucket_name}/*"
      ]
    },
  ]

  env_vars = {
    BUCKET_NAME = var.gtfs_bucket_name
  }
}
