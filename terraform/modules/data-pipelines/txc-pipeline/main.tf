terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
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

resource "aws_s3_bucket" "integrated_data_bods_txc_bucket" {
  bucket = "integrated-data-bods-txc-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_tnds_txc_bucket" {
  bucket = "integrated-data-tnds-txc-${var.environment}"
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

resource "aws_s3_bucket_public_access_block" "integrated_data_bods_txc_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_bods_txc_bucket.bucket

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tnds_txc_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tnds_txc_bucket.bucket

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_gtfs_timetables_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_gtfs_timetables_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
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
      "${aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.arn}/*",
      "${aws_s3_bucket.integrated_data_bods_txc_bucket.arn}/*"
    ]
  }]

  env_vars = {
    STAGE                  = var.environment
    TXC_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.bucket
    TXC_BUCKET_NAME        = aws_s3_bucket.integrated_data_bods_txc_bucket.bucket
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

module "integrated_data_unzipper_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-txc-unzipper"
  zip_path      = "${path.module}/../../../../src/functions/dist/unzipper.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 3072

  permissions = [
    {
      Action = [
        "s3:GetObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.arn}/*",
        "${aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.arn}/*"
      ]
    },
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_bods_txc_bucket.arn}/*",
        "${aws_s3_bucket.integrated_data_tnds_txc_bucket.arn}/*",
      ]
    },
  ]

  env_vars = {
    STAGE                     = var.environment
    UNZIPPED_BODS_BUCKET_NAME = aws_s3_bucket.integrated_data_bods_txc_bucket.id
    UNZIPPED_TNDS_BUCKET_NAME = aws_s3_bucket.integrated_data_tnds_txc_bucket.id
  }
}

module "integrated_data_txc_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-txc-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/txc-processor.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
  memory          = 2048
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

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
        "${aws_s3_bucket.integrated_data_bods_txc_bucket.arn}/*",
        "${aws_s3_bucket.integrated_data_tnds_txc_bucket.arn}/*",
        "arn:aws:s3:::${var.bank_holidays_bucket_name}/*"
      ]
  }]

  env_vars = {
    STAGE                     = var.environment
    DB_HOST                   = var.db_host
    DB_PORT                   = var.db_port
    DB_SECRET_ARN             = var.db_secret_arn
    DB_NAME                   = var.db_name
    BANK_HOLIDAYS_BUCKET_NAME = var.bank_holidays_bucket_name
    TZ                        = "Europe/London"
  }
}

module "integrated_data_gtfs_timetables_generator_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-gtfs-timetables-generator"
  zip_path        = "${path.module}/../../../../src/functions/dist/gtfs-timetables-generator.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 900
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
        "s3:ListBucket",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::${var.rds_output_bucket_name}"
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
