terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "avl_feed_validator" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-feed-validator"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-feed-validator.zip"
  handler       = "index.handler"
  memory        = 1024
  runtime       = "nodejs20.x"
  timeout       = 120

  permissions = [
    {
      Action   = "dynamodb:PutItem",
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}"

    }
  ]


  env_vars = {
    STAGE      = var.environment
    TABLE_NAME = var.avl_subscription_table_name
  }
}
