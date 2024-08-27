terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_bods_siri_vm_analyser_bucket" {
  bucket = "integrated-data-bods-siri-vm-analyser-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_siri_vm_analyser_block_public" {
  bucket = aws_s3_bucket.integrated_data_bods_siri_vm_analyser_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "integrated_data_bods_siri_vm_analyser_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-siri-vm-analyser-function"
  zip_path      = "${path.module}/../../../src/functions/dist/bods-siri-vm-analyser.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  schedule      = "cron(0 * * * ? *)"
  timeout       = 120
  memory        = 1024

  permissions = [
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::${var.siri_vm_bucket_name}/*"
      ]
    },
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_siri_vm_analyser_bucket.arn}/*"
      ]
    },
  ]

  env_vars = {
    STAGE                = var.environment
    SIRI_VM_BUCKET_NAME  = var.siri_vm_bucket_name
    ANALYSIS_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_siri_vm_analyser_bucket.bucket
  }
}
