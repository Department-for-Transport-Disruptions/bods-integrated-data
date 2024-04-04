terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "avl_subscriber" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "avl-subscriber"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-subscriber.zip"
  handler       = "index.handler"
  memory        = 1024
  runtime       = "nodejs20.x"
  timeout       = 120

  env_vars = {
    TABLE_NAME              = var.avl_subscription_table_name,
    STAGE                   = var.environment,
    LOCAL_PRODUCER_ENDPOINT = var.avl_local_data_producer_endpoint != "" ? var.avl_local_data_producer_endpoint : null
    DATA_ENDPOINT           = var.avl_data_endpoint
  }
}

output "lambda_arn" {
  description = "Lambda ARN"
  value       = module.avl_subscriber.lambda_arn
}
