terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_avl_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name     = "integrated-data-avl-${var.environment}"
  sqs_name        = "integrated-data-avl-queue-${var.environment}"
  dlq_name        = "integrated-data-avl-dlq-${var.environment}"
  alarm_topic_arn = var.alarm_topic_arn
  ok_topic_arn    = var.ok_topic_arn
}

module "integrated_data_avl_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-processor.zip"
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
        module.integrated_data_avl_s3_sqs.sqs_arn
      ]
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${module.integrated_data_avl_s3_sqs.bucket_arn}/*"
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
    }
  ]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

resource "aws_lambda_event_source_mapping" "integrated_data_avl_processor_sqs_trigger" {
  event_source_arn = module.integrated_data_avl_s3_sqs.sqs_arn
  function_name    = module.integrated_data_avl_processor_function.lambda_arn
}

module "integrated_data_avl_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory        = 512

  permissions = [
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${module.integrated_data_avl_s3_sqs.bucket_arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE              = var.environment
    TARGET_BUCKET_NAME = module.integrated_data_avl_s3_sqs.bucket_id
  }
}

resource "aws_secretsmanager_secret" "tfl_api_keys_secret" {
  description = "TfL API keys - ${var.environment}"
}

resource "aws_secretsmanager_secret_version" "tfl_api_keys_secret_version" {
  secret_id     = aws_secretsmanager_secret.tfl_api_keys_secret.id
  secret_string = jsonencode(var.tfl_api_keys)
}

module "integrated_data_avl_tfl_location_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-tfl-location-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-tfl-location-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory        = 512

  env_vars = {
    STAGE        = var.environment
    TNDS_FTP_ARN = aws_secretsmanager_secret.tfl_api_keys_secret.arn
  }
}

module "avl_tfl_location_retriever_sfn" {
  count                = var.environment == "local" ? 0 : 1
  step_function_name   = "integrated-data-avl-tfl-location-retriever-sfn"
  source               = "../../shared/lambda-trigger-sfn"
  environment          = var.environment
  function_arn         = module.integrated_data_avl_tfl_location_retriever_function.function_arn
  invoke_every_seconds = 60
  depends_on           = [module.integrated_data_avl_tfl_location_retriever_function]
}
