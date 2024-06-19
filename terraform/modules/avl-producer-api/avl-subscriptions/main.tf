terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
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

  environment   = var.environment
  function_name = "integrated-data-avl-subscriptions"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-subscriptions.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 512

  permissions = [
    {
      Action   = ["dynamodb:Scan"]
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.table_name}"

    },
  ]

  env_vars = {
    STAGE      = var.environment
    TABLE_NAME = var.table_name
  }
}
