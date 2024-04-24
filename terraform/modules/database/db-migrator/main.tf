terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_db_migrator_migrate_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-db-migrator-migrate"
  zip_path        = "${path.module}/../../../../src/functions/dist/db-migrator.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 120
  memory          = 1024
  needs_db_access = true
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [{
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      var.db_secret_arn
    ]
  }]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

module "integrated_data_db_migrator_rollback_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-db-migrator-rollback"
  zip_path        = "${path.module}/../../../../src/functions/dist/db-migrator.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 120
  memory          = 1024
  needs_db_access = true
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [{
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      var.db_secret_arn
    ]
  }]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
    ROLLBACK      = "true"
  }
}
