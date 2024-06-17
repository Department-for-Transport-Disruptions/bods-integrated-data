terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_lambda_function_url" "avl_subscriptions_url" {
  count = var.environment == "local" ? 1 : 0

  function_name      = module.integrated_data_avl_subscriptions_function.function_name
  authorization_type = "NONE"
}

module "integrated_data_avl_subscriptions_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-subscriptions"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-subscriptions.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 60
  memory          = 512
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn
      ]
    },
    {
      Action   = ["dynamodb:Scan"]
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.table_name}"

    },
  ]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
    TABLE_NAME    = var.table_name
  }
}
