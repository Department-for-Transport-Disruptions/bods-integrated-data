terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

module "avl_feed_validator" {
  source = "../../shared/lambda-function"

  environment      = var.environment
  function_name    = "integrated-data-avl-feed-validator"
  zip_path         = "${path.module}/../../../../src/functions/dist/avl-feed-validator.zip"
  handler          = "index.handler"
  memory           = 256
  runtime          = "nodejs22.x"
  timeout          = 120
  needs_vpc_access = true
  custom_sg_id     = var.sg_id
  subnet_ids       = var.subnet_ids
  retry_attempts   = 0

  permissions = [
    {
      Action   = ["dynamodb:PutItem", "dynamodb:Scan"]
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}"

    },
    {
      Action = ["ssm:GetParameter"],
      Effect = "Allow",
      Resource = [
        "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/subscription/*",
        "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/subscription*"
      ]
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
    STAGE                    = var.environment
    TABLE_NAME               = var.avl_subscription_table_name
    SUBSCRIBE_ENDPOINT       = var.avl_consumer_subscribe_endpoint
    AVL_PRODUCER_API_KEY_ARN = var.avl_producer_api_key_arn
  }
}

output "function_arn" {
  value       = module.avl_feed_validator.function_arn
  description = "Function ARN for AVL Feed Validator"
}
