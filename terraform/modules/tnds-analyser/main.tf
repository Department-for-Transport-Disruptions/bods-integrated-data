terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

module "integrated_data_tnds_analysis_table" {
  source = "../shared/dynamo-table"

  environment = var.environment
  table_name  = "integrated-data-tnds-analysis-table"
}

resource "aws_s3_bucket" "integrated_data_tnds_analysis_bucket" {
  bucket = "integrated-data-tnds-analysis-${var.environment}"
}

module "integrated_data_tnds_analysis_cleardown_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-analysis-cleardown"
  zip_path      = "${path.module}/../../../src/functions/dist/tnds-analysis-cleardown.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 128

  permissions = [
    {
      Action   = ["dynamodb:GetItem", "dynamodb:BatchWriteItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_tnds_analysis_table.table_name}"
    }
  ]

  env_vars = {
    STAGE                    = var.environment
    TNDS_ANALYSIS_TABLE_NAME = module.integrated_data_tnds_analysis_table.table_name
  }
}

module "integrated_data_tnds_analyser_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-analyser"
  zip_path      = "${path.module}/../../../src/functions/dist/tnds-analyser.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 900
  memory        = 4096

  permissions = [
    {
      Action   = ["dynamodb:PutItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_tnds_analysis_table.table_name}"
    }
  ]

  env_vars = {
    STAGE                    = var.environment
    TNDS_ANALYSIS_TABLE_NAME = module.integrated_data_tnds_analysis_table.table_name
  }
}

module "integrated_data_tnds_reporter_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-reporter"
  zip_path      = "${path.module}/../../../src/functions/dist/tnds-reporter.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 512

  permissions = [
    {
      Action   = ["dynamodb:GetItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_tnds_analysis_table.table_name}"
    },
    {
      Action = [
        "s3:PutObject",
      ],
      Effect   = "Allow",
      Resource = "${aws_s3_bucket.integrated_data_tnds_analysis_bucket.arn}/*"
    }
  ]

  env_vars = {
    STAGE                    = var.environment
    TNDS_ANALYSIS_TABLE_NAME = module.integrated_data_tnds_analysis_table.table_name
  }
}
