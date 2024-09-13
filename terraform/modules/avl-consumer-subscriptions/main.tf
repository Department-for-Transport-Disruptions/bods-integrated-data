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

resource "aws_iam_policy" "integrated_data_consumer_subscription_schedule_policy" {
  name = "integrated-data-consumer-subscription-schedule-policy-${var.environment}"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution"
        ],
        "Resource" : [
          var.avl_consumer_subscription_trigger_function_arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "integrated_data_consumer_subscription_schedule_role" {
  name = "integrated-data-consumer-subscription-schedule-role-${var.environment}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "scheduler.amazonaws.com"
        },
        "Action" : "sts:AssumeRole",
        "Condition" : {
          "StringEquals" : {
            "aws:SourceAccount" : var.aws_account_id
          }
        }
      }
    ]
  })

  managed_policy_arns = [aws_iam_policy.integrated_data_consumer_subscription_schedule_policy.arn]
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
    },
    {
      Action = [
        "sqs:CreateSchedule"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:scheduler:${var.aws_region}:${var.aws_account_id}:consumer-subscription-schedule-*"
    },
    {
      Action = [
        "sqs:CreateQueue"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:sqs:${var.aws_region}:${var.aws_account_id}:consumer-subscription-queue-*"
    },
    {
      Action = [
        "lambda:CreateEventSourceMapping"
      ],
      Effect   = "Allow",
      Resource = "arn:aws:lambda:${var.aws_region}:${var.aws_account_id}:event-source-mapping:*"
    }
  ]


  env_vars = {
    STAGE                                             = var.environment
    AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME              = module.integrated_data_avl_consumer_subscription_table.table_name
    AVL_PRODUCER_SUBSCRIPTION_TABLE_NAME              = var.avl_producer_subscription_table
    AVL_CONSUMER_SUBSCRIPTION_SEND_DATA_FUNCTION_NAME = var.avl_consumer_subscription_send_data_function_name
    AVL_CONSUMER_SUBSCRIPTION_TRIGGER_FUNCTION_ARN    = var.avl_consumer_subscription_trigger_function_arn
    AVL_CONSUMER_SUBSCRIPTION_SCHEDULE_ROLE_ARN       = var.avl_producer_subscription_table
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
