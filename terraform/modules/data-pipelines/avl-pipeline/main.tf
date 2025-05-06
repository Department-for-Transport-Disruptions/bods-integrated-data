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

module "integrated_data_avl_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name                = "integrated-data-avl-raw-siri-vm-${var.environment}"
  sqs_name                   = "integrated-data-avl-queue-${var.environment}"
  dlq_name                   = "integrated-data-avl-dlq-${var.environment}"
  alarm_topic_arn            = var.alarm_topic_arn
  ok_topic_arn               = var.ok_topic_arn
  visibility_timeout_seconds = 60
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
    },
    {
      Action = ["dynamodb:GetItem"],
      Effect = "Allow",
      Resource = [
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}",
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.gtfs_trip_maps_table_name}",
      ]
    },
    {
      Action   = ["dynamodb:BatchWriteItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_validation_error_table_name}"
    }
  ]

  env_vars = {
    STAGE                           = var.environment
    DB_HOST                         = var.db_host
    DB_PORT                         = var.db_port
    DB_SECRET_ARN                   = var.db_secret_arn
    DB_NAME                         = var.db_name
    AVL_SUBSCRIPTION_TABLE_NAME     = var.avl_subscription_table_name
    AVL_VALIDATION_ERROR_TABLE_NAME = var.avl_validation_error_table_name
    GTFS_TRIP_MAPS_TABLE_NAME       = var.gtfs_trip_maps_table_name
  }
}

resource "aws_lambda_event_source_mapping" "integrated_data_avl_processor_sqs_trigger" {
  event_source_arn = module.integrated_data_avl_s3_sqs.sqs_arn
  function_name    = module.integrated_data_avl_processor_function.lambda_arn
}

module "integrated_data_avl_tfl_line_id_retriever_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-tfl-line-id-retriever"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-tfl-line-id-retriever.zip"
  handler         = "index.handler"
  memory          = 512
  runtime         = "nodejs20.x"
  timeout         = 30
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id
}

resource "aws_secretsmanager_secret" "tfl_api_keys_secret" {
  name = "tfl_api_keys"
}

resource "aws_secretsmanager_secret_version" "tfl_api_keys_secret_version" {
  secret_id     = aws_secretsmanager_secret.tfl_api_keys_secret.id
  secret_string = jsonencode(var.tfl_api_keys)
}

module "integrated_data_avl_tfl_location_retriever_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-tfl-location-retriever"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-tfl-location-retriever.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  memory          = 512
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn,
        aws_secretsmanager_secret.tfl_api_keys_secret.arn
      ]
    },
    {
      Action = ["dynamodb:GetItem"],
      Effect = "Allow",
      Resource = [
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.gtfs_trip_maps_table_name}"
      ]
    },
  ]

  env_vars = {
    STAGE                     = var.environment
    DB_HOST                   = var.db_host
    DB_PORT                   = var.db_port
    DB_SECRET_ARN             = var.db_secret_arn
    DB_NAME                   = var.db_name
    TFL_API_ARN               = aws_secretsmanager_secret.tfl_api_keys_secret.arn
    GTFS_TRIP_MAPS_TABLE_NAME = var.gtfs_trip_maps_table_name
    TZ                        = "Europe/London"
  }
}

module "avl_tfl_location_retriever_sfn" {
  count                               = var.environment == "local" ? 0 : 1
  step_function_name                  = "integrated-data-avl-tfl-location-retriever"
  source                              = "./tfl-location-retriever-sfn"
  environment                         = var.environment
  invoke_every_seconds                = var.tfl_location_retriever_invoke_every_seconds
  depends_on                          = [module.integrated_data_avl_tfl_location_retriever_function, module.integrated_data_avl_tfl_line_id_retriever_function]
  aws_account_id                      = var.aws_account_id
  aws_region                          = var.aws_region
  tfl_line_id_retriever_function_arn  = module.integrated_data_avl_tfl_line_id_retriever_function.function_arn
  tfl_location_retriever_function_arn = module.integrated_data_avl_tfl_location_retriever_function.function_arn
}

resource "aws_s3_bucket" "integrated_data_avl_siri_vm_bucket" {
  bucket = "integrated-data-avl-generated-siri-vm-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_avl_siri_vm_block_public" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_avl_siri_vm_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_iam_policy_document" "integrated_data_avl_bucket_allow_abods_policy" {
  statement {
    principals {
      type        = "AWS"
      identifiers = var.abods_account_ids
    }

    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
    ]

    resources = [
      "${aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn}/SIRI-VM.xml",
    ]
  }
}

resource "aws_s3_bucket_policy" "integrated_data_avl_siri_vm_bucket_policy" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id
  policy = data.aws_iam_policy_document.integrated_data_avl_bucket_allow_abods_policy.json
}

resource "aws_sns_topic" "integrated_data_avl_sirivm_sns_topic" {
  name                        = "integrated-data-siri-vm-topic-${var.environment}.fifo"
  fifo_topic                  = true
  content_based_deduplication = true
}

data "aws_iam_policy_document" "integrated_data_avl_sirivm_sns_policy" {
  statement {
    sid = "AllowABODSSubscribe"
    principals {
      type = "AWS"
      identifiers = [
        for id in var.abods_account_ids :
        "arn:aws:iam::${id}:root"
      ]
    }

    effect = "Allow"
    actions = [
      "sns:Subscribe",
      "sns:ListSubscriptionsByTopic"
    ]
    resources = [aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn]
  }
}

resource "aws_sns_topic_policy" "integrated_data_avl_sirivm_sns_topic_policy" {
  arn    = aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn
  policy = data.aws_iam_policy_document.integrated_data_avl_sirivm_sns_policy.json
}

module "siri_vm_downloader" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "avl-siri-vm-downloader"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-siri-vm-downloader.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
  memory          = 2048
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn}/*"
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
    BUCKET_NAME   = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.bucket
    DB_HOST       = var.db_reader_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

module "siri_vm_stats" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "avl-siri-vm-stats"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-siri-vm-stats.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
  memory          = 2048
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
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
    DB_HOST       = var.db_reader_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

module "integrated_data_avl_data_consumer_subscriptions" {
  source                          = "../../avl-consumer-subscriptions"
  environment                     = var.environment
  aws_account_id                  = var.aws_account_id
  aws_region                      = var.aws_region
  vpc_id                          = var.vpc_id
  subnet_ids                      = var.private_subnet_ids
  db_sg_id                        = var.db_sg_id
  db_host                         = var.db_host
  db_port                         = var.db_port
  db_secret_arn                   = var.db_secret_arn
  db_name                         = var.db_name
  avl_producer_subscription_table = var.avl_subscription_table_name
  alarm_topic_arn                 = var.alarm_topic_arn
  ok_topic_arn                    = var.ok_topic_arn
}

module "integrated_data_siri_vm_generator_lambda" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-siri-vm-file-generator"
  zip_path        = "${path.module}/../../../../src/functions/dist/siri-vm-generator.zip"
  timeout         = 30
  memory          = 3072
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
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
      "Effect" : "Allow",
      "Action" : "sns:Publish",
      "Resource" : "${aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn}"
    },
    {
      "Effect" : "Allow",
      "Action" : "s3:PutObject",
      "Resource" : [
        "${aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn}/*",
        "${var.gtfs_rt_bucket_arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE                 = var.environment
    DB_READER_HOST        = var.db_reader_host
    DB_PORT               = var.db_port
    DB_SECRET_ARN         = var.db_secret_arn
    DB_NAME               = var.db_name
    GTFS_RT_BUCKET_NAME   = var.gtfs_rt_bucket_name
    SAVE_JSON             = var.environment != "prod" ? "true" : "false"
    SIRI_VM_BUCKET_NAME   = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.bucket
    SIRI_VM_SNS_TOPIC_ARN = aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn
    STAGE                 = var.environment
  }

  runtime                    = null
  handler                    = null
  deploy_as_container_lambda = true
}

module "integrated_data_siri_cleardown_lambda" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-siri-cleardown"
  zip_path        = "${path.module}/../../../../src/functions/dist/siri-cleardown.zip"
  timeout         = 180
  memory          = 3072
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id
  schedule        = "cron(0 0 * * ? *)"

  permissions = [
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
    STAGE         = var.environment
  }

  runtime                    = null
  handler                    = null
  deploy_as_container_lambda = true
}

module "integrated_data_siri_vm_generator_sfn" {
  source = "../../shared/lambda-trigger-sfn"

  environment          = var.environment
  function_arn         = module.integrated_data_siri_vm_generator_lambda.lambda_arn
  invoke_every_seconds = var.siri_vm_generator_frequency
  step_function_name   = "integrated-data-siri-vm-file-generator"
}
