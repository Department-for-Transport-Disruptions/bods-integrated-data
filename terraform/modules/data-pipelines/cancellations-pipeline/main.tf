terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

data "aws_caller_identity" "current" {}

module "integrated_data_cancellations_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name                = "integrated-data-cancellations-raw-siri-sx-${var.environment}"
  sqs_name                   = "integrated-data-cancellations-queue-${var.environment}"
  dlq_name                   = "integrated-data-cancellations-dlq-${var.environment}"
  alarm_topic_arn            = var.alarm_topic_arn
  ok_topic_arn               = var.ok_topic_arn
  visibility_timeout_seconds = 60
}

module "integrated_data_cancellations_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-cancellations-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/cancellations-processor.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 60
  memory          = 1024
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      Effect = "Allow",
      Resource = [
        module.integrated_data_cancellations_s3_sqs.sqs_arn
      ]
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${module.integrated_data_cancellations_s3_sqs.bucket_arn}/*"
      ]
    },
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
      Action   = ["dynamodb:GetItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.cancellations_subscription_table_name}"
    },
  ]

  env_vars = {
    STAGE                                 = var.environment
    DB_HOST                               = var.db_host
    DB_PORT                               = var.db_port
    DB_SECRET_ARN                         = var.db_secret_arn
    DB_NAME                               = var.db_name
    CANCELLATIONS_SUBSCRIPTION_TABLE_NAME = var.cancellations_subscription_table_name
  }
}

resource "aws_lambda_event_source_mapping" "integrated_data_cancellations_processor_sqs_trigger" {
  event_source_arn = module.integrated_data_cancellations_s3_sqs.sqs_arn
  function_name    = module.integrated_data_cancellations_processor_function.lambda_arn
}
