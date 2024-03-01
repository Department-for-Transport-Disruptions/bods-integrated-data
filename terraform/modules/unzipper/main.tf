terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_iam_policy" "integrated_data_unzipper_policy" {
  name = "integrated-data-unzipper-policy-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ],
        Effect = "Allow",
        Resource = [
          "${var.zipped_bucket_arn}/*"
        ]
      },
      {
        Action = [
          "s3:PutObject"
        ],
        Effect = "Allow",
        Resource = [
          "${var.unzipped_bucket_arn}/*"
        ]
      },
    ]
  })
}

resource "aws_iam_role" "integrated_data_unzipper_role" {
  name = "integrated-data-unzipper-role-${var.environment}"

  managed_policy_arns = [aws_iam_policy.integrated_data_unzipper_policy.arn, "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
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

module "integrated_data_unzipper_function" {
  source = "../shared/lambda-function"

  function_name = "integrated-data-unzipper-${var.environment}"
  zip_path      = "${path.module}/../../../src/functions/dist/unzipper.zip"
  role_arn      = aws_iam_role.integrated_data_unzipper_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 3072
  s3_bucket_trigger = {
    id  = var.zipped_bucket_name
    arn = var.zipped_bucket_arn
  }

  env_vars = {
    UNZIPPED_BUCKET_NAME = var.unzipped_bucket_name
  }
}
