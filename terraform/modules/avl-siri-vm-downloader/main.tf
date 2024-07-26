terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_lambda_function_url" "avl_siri_vm_downloader_function_url" {
  function_name      = module.integrated_data_avl_siri_vm_downloader_function.function_name
  authorization_type = var.environment == "local" ? "NONE" : "AWS_IAM"
  invoke_mode        = "RESPONSE_STREAM"
}

resource "aws_secretsmanager_secret" "avl_consumer_api_key_secret" {
  name = "avl_consumer_api_key"
}

resource "aws_secretsmanager_secret_version" "avl_consumer_api_key_secret_version" {
  secret_id     = aws_secretsmanager_secret.avl_consumer_api_key_secret.id
  secret_string = jsonencode(var.avl_consumer_api_key)
}

module "integrated_data_avl_siri_vm_downloader_function" {
  source = "../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-siri-vm-downloader"
  zip_path        = "${path.module}/../../../src/functions/dist/avl-siri-vm-downloader.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 60
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
        "arn:aws:s3:::${var.bucket_name}/*"
      ]
    },
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn,
        aws_secretsmanager_secret.avl_consumer_api_key_secret.arn
      ]
    },
    {
      Action = [
        "cloudwatch:PutMetricData"
      ],
      Effect   = "Allow",
      Resource = "*"
    }
  ]

  env_vars = {
    STAGE                    = var.environment
    DB_HOST                  = var.db_host
    DB_PORT                  = var.db_port
    DB_SECRET_ARN            = var.db_secret_arn
    DB_NAME                  = var.db_name
    BUCKET_NAME              = var.bucket_name
    AVL_CONSUMER_API_KEY_ARN = aws_secretsmanager_secret.avl_consumer_api_key_secret.arn
  }
}
