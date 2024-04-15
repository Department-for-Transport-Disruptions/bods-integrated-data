terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_table_renamer_function" {
  source = "../../shared/lambda-function"

  environment    = var.environment
  function_name  = "integrated-data-table-renamer"
  zip_path       = "${path.module}/../../../../src/functions/dist/table-renamer.zip"
  handler        = "index.handler"
  runtime        = "nodejs20.x"
  timeout        = 120
  memory         = 1024
  schedule       = "cron(0 5 * * ? *)"
  vpc_id         = var.vpc_id
  subnet_ids     = var.private_subnet_ids
  database_sg_id = var.db_sg_id

  permissions = [{
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      var.db_secret_arn,
    ]
  }]

  env_vars = {
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}
