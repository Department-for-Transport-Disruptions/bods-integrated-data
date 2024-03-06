terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_bods_unzipper_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-unzipper"
  zip_path      = "${path.module}/../../../src/functions/dist/unzipper.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 3072
  s3_bucket_trigger = {
    id  = var.zipped_bucket_name
    arn = var.zipped_bucket_arn
  }

  permissions = [
    {
      Action = [
        "s3:PutObject",
        "s3:GetObject"
      ],
      Effect = "Allow",
      Resource = [
        "${var.zipped_bucket_arn}/*"
      ]
    },
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${var.unzipped_bucket_arn}/*"
      ]
    },
  ]

  env_vars = {
    UNZIPPED_BUCKET_NAME = var.unzipped_bucket_name
  }
}
