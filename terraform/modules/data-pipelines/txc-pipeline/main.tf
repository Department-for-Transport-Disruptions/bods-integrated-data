terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_bods_txc_zipped_bucket" {
  bucket = "integrated-data-bods-txc-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_tnds_txc_zipped_bucket" {
  bucket = "integrated-data-tnds-txc-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_gtfs_timetables_bucket" {
  bucket = "integrated-data-gtfs-timetables-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_txc_zipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tnds_txc_zipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_gtfs_timetables_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_gtfs_timetables_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_secretsmanager_secret" "tnds_ftp_credentials_secret" {
  description = "Integrated data tnds ftp credentials - ${var.environment}"
}

resource "aws_secretsmanager_secret_version" "tnds_ftp_credentials_secret_version" {
  secret_id     = aws_secretsmanager_secret.tnds_ftp_credentials_secret.id
  secret_string = jsonencode(var.tnds_ftp_credentials)
}

module "integrated_data_bods_txc_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-txc-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/bods-txc-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 1024

  permissions = [{
    Action = [
      "s3:PutObject",
    ],
    Effect = "Allow",
    Resource = [
      "${aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.arn}/*"
    ]
  }]

  env_vars = {
    STAGE                  = var.environment
    TXC_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.bucket
  }
}

module "integrated_data_tnds_txc_retriever_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-txc-retriever"
  zip_path      = "${path.module}/../../../../src/functions/dist/tnds-txc-retriever.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 1024

  permissions = [{
    Action = [
      "s3:PutObject",
    ],
    Effect = "Allow",
    Resource = [
      "${aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.arn}/*"
    ]
    }, {
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      aws_secretsmanager_secret.tnds_ftp_credentials_secret.arn
    ]
  }]

  env_vars = {
    STAGE                  = var.environment
    TXC_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.bucket
    TNDS_FTP_ARN           = aws_secretsmanager_secret.tnds_ftp_credentials_secret.arn
  }
}

module "integrated_data_txc_retriever_function" {
  source = "../../shared/lambda-function"

  environment    = var.environment
  function_name  = "integrated-data-txc-retriever"
  zip_path       = "${path.module}/../../../../src/functions/dist/txc-retriever.zip"
  handler        = "index.handler"
  runtime        = "nodejs20.x"
  timeout        = 60
  memory         = 1024
  vpc_id         = var.vpc_id
  subnet_ids     = var.private_subnet_ids
  database_sg_id = var.db_sg_id

  permissions = [{
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      var.db_secret_arn,
      aws_secretsmanager_secret.tnds_ftp_credentials_secret.arn
    ]
    },
    {
      Action = ["lambda:invokeAsync", "lambda:invokeFunction"],
      Effect = "Allow",
      Resource = [
        module.integrated_data_bods_txc_retriever_function.function_arn,
        module.integrated_data_tnds_txc_retriever_function.function_arn
      ]
  }]

  env_vars = {
    STAGE                            = var.environment
    BODS_TXC_RETRIEVER_FUNCTION_NAME = module.integrated_data_bods_txc_retriever_function.function_name
    TNDS_TXC_RETRIEVER_FUNCTION_NAME = module.integrated_data_tnds_txc_retriever_function.function_name
    DB_HOST                          = var.db_host
    DB_PORT                          = var.db_port
    DB_SECRET_ARN                    = var.db_secret_arn
    DB_NAME                          = var.db_name
  }
}

module "integrated_data_bods_txc_unzipper_function" {
  source = "../../unzipper"

  function_name        = "integrated-data-bods-txc-unzipper"
  environment          = var.environment
  unzipped_bucket_arn  = module.integrated_data_txc_s3_sqs.bucket_arn
  unzipped_bucket_name = module.integrated_data_txc_s3_sqs.bucket_id
  zipped_bucket_arn    = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.arn
  zipped_bucket_name   = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.bucket
}

module "integrated_data_tnds_txc_unzipper_function" {
  source = "../../unzipper"

  function_name        = "integrated-data-tnds-txc-unzipper"
  environment          = var.environment
  unzipped_bucket_arn  = module.integrated_data_txc_s3_sqs.bucket_arn
  unzipped_bucket_name = module.integrated_data_txc_s3_sqs.bucket_id
  zipped_bucket_arn    = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.arn
  zipped_bucket_name   = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.bucket
}

module "integrated_data_txc_processor_function" {
  source = "../../shared/lambda-function"

  environment    = var.environment
  function_name  = "integrated-data-txc-processor"
  zip_path       = "${path.module}/../../../../src/functions/dist/txc-processor.zip"
  handler        = "index.handler"
  runtime        = "nodejs20.x"
  timeout        = 300
  memory         = 2048
  vpc_id         = var.vpc_id
  subnet_ids     = var.private_subnet_ids
  database_sg_id = var.db_sg_id

  permissions = [{
    Action = [
      "secretsmanager:GetSecretValue",
    ],
    Effect = "Allow",
    Resource = [
      var.db_secret_arn,
    ]
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${module.integrated_data_txc_s3_sqs.bucket_arn}/*"
      ]
    },
    {
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      Effect = "Allow",
      Resource = [
        module.integrated_data_txc_s3_sqs.sqs_arn
      ]
  }]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

module "integrated_data_txc_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name                = "integrated-data-txc-${var.environment}"
  sqs_name                   = "integrated-data-txc-queue-${var.environment}"
  dlq_name                   = "integrated-data-txc-dlq-${var.environment}"
  visibility_timeout_seconds = 200
  alarm_topic_arn            = var.alarm_topic_arn
  ok_topic_arn               = var.ok_topic_arn
}

resource "aws_lambda_event_source_mapping" "integrated_data_txc_processor_sqs_trigger" {
  event_source_arn = module.integrated_data_txc_s3_sqs.sqs_arn
  function_name    = module.integrated_data_txc_processor_function.lambda_arn
  batch_size       = 1
  scaling_config {
    maximum_concurrency = 50
  }
}

module "integrated_data_gtfs_timetables_generator_function" {
  source = "../../shared/lambda-function"

  environment    = var.environment
  function_name  = "integrated-data-gtfs-timetables-generator"
  zip_path       = "${path.module}/../../../../src/functions/dist/gtfs-timetables-generator.zip"
  handler        = "index.handler"
  runtime        = "nodejs20.x"
  timeout        = 600
  memory         = 2048
  vpc_id         = var.vpc_id
  subnet_ids     = var.private_subnet_ids
  database_sg_id = var.db_sg_id

  permissions = [
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn,
      ]
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::${var.rds_output_bucket_name}/*"
      ]
    },
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_gtfs_timetables_bucket.arn}/*"
      ]
    }
  ]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
    OUTPUT_BUCKET = var.rds_output_bucket_name
    GTFS_BUCKET   = aws_s3_bucket.integrated_data_gtfs_timetables_bucket.bucket
  }
}
