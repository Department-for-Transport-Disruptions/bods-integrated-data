terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

module "avl_datafeed_validator" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-datafeed-validator"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-datafeed-validator.zip"
  handler       = "index.handler"
  memory        = 512
  runtime       = "nodejs20.x"
  timeout       = 120

  permissions = [
    {
      Action   = ["dynamodb:Query"]
      Effect   = "Allow",
      Resource = ["arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_error_table_name}"]

    },
    {
      Action = [
        "dynamodb:GetItem"
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}"
      ]
    },
    {
      Action = [
        "logs:StartQuery",
        "logs:GetQueryResults"
      ],
      Effect   = "Allow",
      Resource = "*"
    },
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.avl_producer_api_key_arn
      ]
    }
  ]

  env_vars = {
    STAGE                        = var.environment
    AVL_VALIDATION_ERROR_TABLE   = var.avl_error_table_name
    AVL_PRODUCER_API_KEY_ARN     = var.avl_producer_api_key_arn
    AVL_PROCESSOR_LOG_GROUP_NAME = "/aws/lambda/integrated-data-avl-processor-${var.environment}"
    AVL_SUBSCRIPTIONS_TABLE_NAME = var.avl_subscription_table_name
  }
}

output "function_arn" {
  value       = module.avl_datafeed_validator.function_arn
  description = "Function ARN for AVL Datafeed Validator"
}
