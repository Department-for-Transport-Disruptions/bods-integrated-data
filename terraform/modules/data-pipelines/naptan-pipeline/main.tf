terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

resource "aws_s3_bucket" "integrated_data_naptan_s3_bucket" {
  bucket = "integrated-data-naptan-stops-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_naptan_s3_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_naptan_s3_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_policy" "integrated_data_naptan_retriever_policy" {
  name = "integrated-data-naptan-retriever-policy-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:PutObject",
        ],
        Effect = "Allow",
        Resource = [
          "${aws_s3_bucket.integrated_data_naptan_s3_bucket.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role" "integrated_data_naptan_retriever_role" {
  name = "integrated-data-naptan-retriever-role-${var.environment}"

  managed_policy_arns = [aws_iam_policy.integrated_data_naptan_retriever_policy.arn, "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "lambda.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "integrated_data_naptan_uploader_policy" {
  name = "integrated-data-naptan-uploader-policy-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:GetObject",
        ],
        Effect = "Allow",
        Resource = [
          "${aws_s3_bucket.integrated_data_naptan_s3_bucket.arn}/*"
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
  })
}

resource "aws_iam_role" "integrated_data_naptan_uploader_role" {
  name = "integrated-data-naptan-uploader-role-${var.environment}"

  managed_policy_arns = [aws_iam_policy.integrated_data_naptan_uploader_policy.arn, "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"]
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "lambda.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_security_group" "integrated_data_naptan_uploader_sg" {
  name   = "integrated-data-naptan-uploader-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_naptan_uploader_sg_allow_all_egress_ipv4" {
  security_group_id = aws_security_group.integrated_data_naptan_uploader_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_naptan_uploader_sg_allow_all_egress_ipv6" {
  security_group_id = aws_security_group.integrated_data_naptan_uploader_sg.id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_db_sg_allow_lambda_ingress" {
  security_group_id            = var.db_sg_id
  referenced_security_group_id = aws_security_group.integrated_data_naptan_uploader_sg.id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

module "integrated_data_naptan_retriever_function" {
  source = "../../shared/lambda-function"

  function_name = "integrated-data-naptan-retriever-${var.environment}"
  zip_path      = "${path.module}/../../../../src/functions/dist/naptan-retriever.zip"
  role_arn      = aws_iam_role.integrated_data_naptan_retriever_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 1024
  schedule      = "cron(0 2 * * ? *)"

  env_vars = {
    BUCKET_NAME = aws_s3_bucket.integrated_data_naptan_s3_bucket.bucket
  }
}

module "integrated_data_naptan_uploader_function" {
  source = "../../shared/lambda-function"

  function_name      = "integrated-data-naptan-uploader-${var.environment}"
  zip_path           = "${path.module}/../../../../src/functions/dist/naptan-uploader.zip"
  role_arn           = aws_iam_role.integrated_data_naptan_uploader_role.arn
  handler            = "index.handler"
  runtime            = "nodejs20.x"
  timeout            = 300
  memory             = 3008
  subnet_ids         = var.private_subnet_ids
  security_group_ids = [aws_security_group.integrated_data_naptan_uploader_sg.id]
  s3_bucket_trigger = {
    id  = aws_s3_bucket.integrated_data_naptan_s3_bucket.id
    arn = aws_s3_bucket.integrated_data_naptan_s3_bucket.arn
  }

  env_vars = {
    BUCKET_NAME   = aws_s3_bucket.integrated_data_naptan_s3_bucket.bucket
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}
