terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }

    archive = {
      source = "hashicorp/archive"
      version = "~> 2.4"

    }
  }
}

resource "aws_cloudwatch_log_group" "lambda_transform_siri_logging_group" {
  name = "/aws/lambda/${local.lambda_name}"
}

resource "aws_iam_policy" "lambda_transform_siri_policy" {
  name = "avl-lambda-transform-siri-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": ["${aws_cloudwatch_log_group.lambda_transform_siri_logging_group.arn}:*"],
        "Effect": "Allow"
      },
      {
            "Effect": "Allow",
            "Action": [
                "kinesis:DescribeStream",
                "kinesis:DescribeStreamSummary",
                "kinesis:GetRecords",
                "kinesis:GetShardIterator",
                "kinesis:ListShards",
                "kinesis:ListStreams",
                "kinesis:SubscribeToShard",
            ],
            "Resource": ["arn:aws:kinesis:${var.region}:${var.account_id}:stream/${local.kinesis_firehose_stream_name}"]
        }
    ]
  })
}


resource "aws_iam_role" "iam_for_lambda" {
  name               = "avl-lambda-transform-siri-role-${var.environment}"
  managed_policy_arns = [aws_iam_policy.lambda_transform_siri_policy.arn]
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

module "avl_transform_siri" {
  source = "../../shared/lambda-function"

  function_name = local.lambda_name
  zip_path      = "${path.module}/../../../../src/functions/dist/transform-siri.zip"
  handler       = "functions/transform-siri/index.handler"
  memory        = 1024
  role_arn      = aws_iam_role.iam_for_lambda.arn
  runtime       = "nodejs20.x"
  timeout       = 60
}

output "avl_transform_siri_lambda_arn" {
  value = module.avl_transform_siri.lambda_arn
}

locals {
  lambda_name = "avl-transform-siri-${var.environment}"
  kinesis_firehose_stream_name = "avl-kinesis-firehose-stream-${var.environment}"
}