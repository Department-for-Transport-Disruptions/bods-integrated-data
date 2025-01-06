module "integrated_data_tnds_analysis_table" {
    source = "../shared/dynamo-table"

  environment = var.environment
  table_name  = "integrated-data-tnds-analysis-table"
}

resource "aws_s3_bucket" "integrated_data_tnds_analysis_bucket" {
  bucket = "integrated-data-tnds-analysis-${var.environment}"
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

  env_vars = {
    STAGE = var.environment
    TABLE_NAME = module.integrated_data_tnds_analysis_table.table_name
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

  env_vars = {
    STAGE = var.environment
  }
}
