terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "avl_unsubscriber" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "avl-unsubscriber"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-unsubscriber.zip"
  handler       = "index.handler"
  memory        = 1024
  runtime       = "nodejs20.x"
  timeout       = 120

  permissions = [
    {
      Action   = ["ssm:GetParameter", "ssm:DeleteParameters"],
      Effect   = "Allow",
      Resource = [
        "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/subscription/*",
        "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/subscription*"
      ]
    },
    {
      Action   = ["dynamodb:PutItem", "dynamodb:GetItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}"
    }
  ]


  env_vars = {
    STAGE      = var.environment
    TABLE_NAME = var.avl_subscription_table_name
  }
}
