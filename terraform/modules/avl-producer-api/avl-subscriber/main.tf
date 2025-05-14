terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

module "avl_subscriber" {
  source = "../../shared/lambda-function"

  environment      = var.environment
  function_name    = "integrated-data-avl-subscriber"
  zip_path         = "${path.module}/../../../../src/functions/dist/avl-subscriber.zip"
  handler          = "index.handler"
  memory           = 1024
  runtime          = "nodejs20.x"
  timeout          = 120
  needs_vpc_access = true
  custom_sg_id     = var.sg_id
  subnet_ids       = var.subnet_ids
  retry_attempts   = 0

  permissions = [
    {
      Action = "ssm:PutParameter",
      Effect = "Allow",
      Resource = [
        "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/subscription/*",
        "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/subscription*"
      ]
    },
    {
      Action = [
        "dynamodb:PutItem",
        "dynamodb:GetItem"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}"

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
    STAGE                            = var.environment
    TABLE_NAME                       = var.avl_subscription_table_name
    MOCK_PRODUCER_SUBSCRIBE_ENDPOINT = var.avl_mock_data_producer_subscribe_endpoint
    DATA_ENDPOINT                    = var.avl_data_endpoint
    INTERNAL_DATA_ENDPOINT           = var.avl_internal_data_endpoint
    AVL_PRODUCER_API_KEY_ARN         = var.avl_producer_api_key_arn
  }
}
