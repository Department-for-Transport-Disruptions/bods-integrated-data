terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

module "integrated_data_avl_consumer_subscription_table" {
  source = "../shared/dynamo-table"

  environment = var.environment
  table_name  = "integrated-data-avl-consumer-subscription-table"
  global_secondary_indexes = [{
    hash_key  = "subscriptionId"
    range_key = "SK"
  }]
}

module "avl_consumer_subscriber" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-consumer-subscriber"
  zip_path      = "${path.module}/../../../src/functions/dist/avl-consumer-subscriber.zip"
  handler       = "index.handler"
  memory        = 256
  runtime       = "nodejs20.x"
  timeout       = 60

  permissions = [
    {
      Action = [
        "dynamodb:Query",
        "dynamodb:PutItem"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_avl_consumer_subscription_table.table_name}"
    },
    {
      Action = [
        "dynamodb:GetItem"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_producer_subscription_table}"
    }
  ]


  env_vars = {
    STAGE                                = var.environment
    AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = module.integrated_data_avl_consumer_subscription_table.table_name
    AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME = var.avl_producer_subscription_table
  }
}


module "avl_consumer_unsubscriber" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-consumer-unsubscriber"
  zip_path      = "${path.module}/../../../src/functions/dist/avl-consumer-unsubscriber.zip"
  handler       = "index.handler"
  memory        = 256
  runtime       = "nodejs20.x"
  timeout       = 60

  permissions = [
    {
      Action = [
        "dynamodb:PutItem",
        "dynamodb:Scan"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_avl_consumer_subscription_table.table_name}"
    }
  ]


  env_vars = {
    STAGE                                = var.environment
    AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = module.integrated_data_avl_consumer_subscription_table.table_name
  }
}

module "avl_consumer_data_sender" {
  source = "../shared/lambda-function"

  environment      = var.environment
  function_name    = "integrated-data-avl-consumer-data-sender"
  zip_path         = "${path.module}/../../../src/functions/dist/avl-consumer-data-sender.zip"
  handler          = "index.handler"
  memory           = 1024
  runtime          = "nodejs20.x"
  timeout          = 60
  needs_vpc_access = true
  custom_sg_id     = var.sg_id
  subnet_ids       = var.subnet_ids
  database_sg_id   = var.db_sg_id

  permissions = [
    {
      Action = [
        "dynamodb:Query",
        "dynamodb:PutItem"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_avl_consumer_subscription_table.table_name}"
    },
    {
      Action = [
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ReceiveMessage"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:consumer-subscription-queue-*"
    },
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn
      ]
    }
  ]


  env_vars = {
    STAGE                                = var.environment
    DB_HOST                              = var.db_host
    DB_PORT                              = var.db_port
    DB_SECRET_ARN                        = var.db_secret_arn
    DB_NAME                              = var.db_name
    AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = module.integrated_data_avl_consumer_subscription_table.table_name
  }
}


module "avl_consumer_heartbeat_notification" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-consumer-heartbeat-notification"
  zip_path      = "${path.module}/../../../src/functions/dist/avl-consumer-heartbeat-notification.zip"
  handler       = "index.handler"
  memory        = 256
  runtime       = "nodejs20.x"
  timeout       = 60

  permissions = [
    {
      Action = [
        "dynamodb:Query",
        "dynamodb:PutItem"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_avl_consumer_subscription_table.table_name}"
    }
  ]


  env_vars = {
    STAGE                                = var.environment
    AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME = module.integrated_data_avl_consumer_subscription_table.table_name
  }
}

module "avl_consumer_heartbeat_notification_sfn" {
  count                = var.environment == "local" ? 0 : 1
  step_function_name   = "integrated-data-avl-consumer-hb-notification"
  source               = "../../modules/shared/lambda-trigger-sfn"
  environment          = var.environment
  function_arn         = module.avl_consumer_heartbeat_notification.function_arn
  invoke_every_seconds = 30
  depends_on           = [module.avl_consumer_heartbeat_notification]
}
