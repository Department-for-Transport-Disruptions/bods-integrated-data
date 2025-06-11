terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_s3_bucket" "integrated_data_tfl_timetable_zipped_bucket" {
  bucket = "integrated-data-tfl-timetable-zipped-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_tfl_timetable_bucket" {
  bucket = "integrated-data-tfl-timetable-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_tfl_txc_bucket" {
  bucket = "integrated-data-tfl-txc-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tfl_timetable_zipped_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tfl_timetable_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "integrated_data_tfl_txc_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_tfl_txc_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_tfl_timetable_zipped_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.id
  rule {
    id = "config"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "integrated_data_tfl_timetable_bucket_lifecycle" {
  bucket = aws_s3_bucket.integrated_data_tfl_timetable_bucket.id
  rule {
    id = "config"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "integrated_data_tfl_txc_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_tfl_txc_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

module "integrated_data_tfl_timetable_retriever_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-tfl-timetable-retriever"
  zip_path        = "${path.module}/../../../../src/functions/dist/tfl-timetable-retriever.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 600
  memory          = 512
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "s3:ListBucket",
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.arn,
        "${aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.arn}/*"
      ]
    },
    {
      Action = [
        "s3:GetObject",
        "s3:ListBucket",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::ibus.data.tfl.gov.uk",
        "arn:aws:s3:::ibus.data.tfl.gov.uk/*"
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
  ]

  env_vars = {
    STAGE                            = var.environment
    TFL_TIMETABLE_ZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.bucket
    DB_HOST                          = var.db_host
    DB_PORT                          = var.db_port
    DB_SECRET_ARN                    = var.db_secret_arn
    DB_NAME                          = var.db_name
  }
}

module "integrated_data_tfl_timetable_unzipper_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tfl-timetable-unzipper"
  zip_path      = "${path.module}/../../../../src/functions/dist/tfl-timetable-unzipper.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 256

  permissions = [
    {
      Action = [
        "s3:GetObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.arn}/*",
      ]
    },
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_tfl_timetable_bucket.arn}/*",
      ]
    },
  ]

  env_vars = {
    STAGE                = var.environment
    UNZIPPED_BUCKET_NAME = aws_s3_bucket.integrated_data_tfl_timetable_bucket.id
  }
}

module "integrated_data_tfl_timetable_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-tfl-timetable-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/tfl-timetable-processor.zip"
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
        "${aws_s3_bucket.integrated_data_tfl_timetable_bucket.arn}/*"
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
  ]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

module "integrated_data_tfl_txc_line_id_retriever_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-tfl-txc-line-id-retriever"
  zip_path        = "${path.module}/../../../../src/functions/dist/tfl-txc-line-id-retriever.zip"
  handler         = "index.handler"
  runtime         = "nodejs22.x"
  timeout         = 60
  memory          = 1024
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
  ]

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

module "integrated_data_tfl_txc_generator_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-tfl-txc-generator"
  zip_path        = "${path.module}/../../../../src/functions/dist/tfl-txc-generator.zip"
  handler         = "index.handler"
  runtime         = "nodejs22.x"
  timeout         = 300
  memory          = 2048
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "s3:PutObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_tfl_txc_bucket.arn}/*"
      ]
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::${var.bank_holidays_bucket_name}/*"
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
  ]

  env_vars = {
    BANK_HOLIDAYS_BUCKET_NAME = var.bank_holidays_bucket_name
    TFL_TXC_BUCKET_NAME       = aws_s3_bucket.integrated_data_tfl_txc_bucket.bucket
    STAGE                     = var.environment
    DB_HOST                   = var.db_host
    DB_PORT                   = var.db_port
    DB_SECRET_ARN             = var.db_secret_arn
    DB_NAME                   = var.db_name
  }
}

resource "aws_iam_role" "integrated_data_tfl_txc_sfn_role" {
  name = "integrated-data-tfl-txc-sfn-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_sfn_state_machine" "integrated_data_tfl_txc_sfn" {
  name     = "integrated-data-tfl-txc-sfn-${var.environment}"
  role_arn = aws_iam_role.integrated_data_tfl_txc_sfn_role.arn
  definition = templatefile("${path.module}/tfl-txc-generator-state-machine.asl.json", {
    tfl_txc_line_id_retriever_function_arn = module.integrated_data_tfl_txc_line_id_retriever_function.function_arn
    tfl_txc_generator_function_arn         = module.integrated_data_tfl_txc_generator_function.function_arn
    tfl_timetable_retriever_function_arn   = module.integrated_data_tfl_timetable_retriever_function.function_arn
    tfl_timetable_unzipper_function_arn    = module.integrated_data_tfl_timetable_unzipper_function.function_arn
    tfl_timetable_processor_function_arn   = module.integrated_data_tfl_timetable_processor_function.function_arn
    tfl_timetable_zipped_bucket_name       = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.bucket
    tfl_timetable_bucket_name              = aws_s3_bucket.integrated_data_tfl_timetable_bucket.bucket
  })
}

resource "aws_iam_policy" "integrated_data_tfl_txc_sfn_policy" {
  name = "integrated-data-tfl-txc-sfn-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : [
          "lambda:InvokeFunction"
        ],
        "Resource" : [
          module.integrated_data_tfl_txc_generator_function.function_arn,
          "${module.integrated_data_tfl_txc_generator_function.function_arn}*",
          module.integrated_data_tfl_txc_line_id_retriever_function.function_arn,
          "${module.integrated_data_tfl_txc_line_id_retriever_function.function_arn}*",
          module.integrated_data_tfl_timetable_retriever_function.function_arn,
          "${module.integrated_data_tfl_timetable_retriever_function.function_arn}*",
          module.integrated_data_tfl_timetable_unzipper_function.function_arn,
          "${module.integrated_data_tfl_timetable_unzipper_function.function_arn}*",
          module.integrated_data_tfl_timetable_processor_function.function_arn,
          "${module.integrated_data_tfl_timetable_processor_function.function_arn}*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "s3:ListBucket"
        ],
        "Resource" : [
          aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.arn,
          aws_s3_bucket.integrated_data_tfl_timetable_bucket.arn,
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:RedriveExecution"
        ],
        "Resource" : [
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:execution:${aws_sfn_state_machine.integrated_data_tfl_txc_sfn.name}/*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution",
          "states:DescribeExecution",
          "states:StopExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_tfl_txc_sfn.arn
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ],
        "Resource" : [
          "*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "integrated_data_tfl_txc_sfn_policy_attachment" {
  role       = aws_iam_role.integrated_data_tfl_txc_sfn_role.name
  policy_arn = aws_iam_policy.integrated_data_tfl_txc_sfn_policy.arn
}
