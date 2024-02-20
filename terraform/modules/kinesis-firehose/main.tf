terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_cloudwatch_log_group" "kinesis_firehose_stream_logging_group" {
  name = "/aws/kinesisfirehose/cavl-kinesis-firehose-stream-${var.environment}"
}

resource "aws_cloudwatch_log_stream" "kinesis_firehose_stream_logging_stream" {
  log_group_name = aws_cloudwatch_log_group.kinesis_firehose_stream_logging_group.name
  name           = "S3Delivery"
}

resource "aws_s3_bucket" "kinesis_firehose_stream_bucket" {
  bucket = "cavl-kinesis-firehose-destination-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "block_kinesis_firehose_stream_bucket_public_access" {
  bucket                  = aws_s3_bucket.kinesis_firehose_stream_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "kinesis_firehose_stream_trust_policy" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["firehose.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "kinesis_firehose_policy" {
  name = "cavl-kinesis-firehose-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject",
        ]
        Effect = "Allow"
        Resource = [
          aws_s3_bucket.kinesis_firehose_stream_bucket.arn,
          "${aws_s3_bucket.kinesis_firehose_stream_bucket.arn}/*",
        ]
      },
      {
        Action = [
          "kinesis:DescribeStream",
          "kinesis:GetShardIterator",
          "kinesis:GetRecords",
          "kinesis:ListShards"
        ]
        Effect = "Allow"
        Resource = [
          "arn:aws:kinesis:${var.region}:${var.account_id}:stream/${local.stream_name}"
        ]
      },
      {
        Action = [
          "logs:PutLogEvents"
        ]
        Effect = "Allow"
        Resource = [
          aws_cloudwatch_log_stream.kinesis_firehose_stream_logging_stream.arn
        ]
      },
      {
           "Effect": "Allow",
           "Action": [
               "lambda:InvokeFunction",
               "lambda:GetFunctionConfiguration"
           ],
           "Resource": [
               var.transform_siri_lambda_arn
           ]
      }
    ]
  })
}

resource "aws_iam_role" "kinesis_firehose_stream_role" {
  name                = "cavl-kinesis-firehose-stream-role-${var.environment}"
  assume_role_policy  = data.aws_iam_policy_document.kinesis_firehose_stream_trust_policy.json
  managed_policy_arns = [aws_iam_policy.kinesis_firehose_policy.arn]
}

resource "aws_kinesis_firehose_delivery_stream" "kinesis_firehose_stream" {
  name        = local.stream_name
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn           = aws_iam_role.kinesis_firehose_stream_role.arn
    bucket_arn         = aws_s3_bucket.kinesis_firehose_stream_bucket.arn
    buffering_interval = 0

    processing_configuration {
      enabled = "true"

      processors {
        type = "Lambda"

        parameters {
          parameter_name  = "LambdaArn"
          parameter_value = var.transform_siri_lambda_arn
        }
      }
    }

    s3_backup_configuration {
      role_arn   = aws_iam_role.kinesis_firehose_stream_role.arn
      bucket_arn = aws_s3_bucket.kinesis_firehose_stream_bucket.arn
      prefix     = "cavl-kinesis-backup-stream-${var.environment}"

      cloudwatch_logging_options {
        enabled         = true
        log_group_name  = aws_cloudwatch_log_group.kinesis_firehose_stream_logging_group.name
        log_stream_name = aws_cloudwatch_log_stream.kinesis_firehose_stream_logging_stream.name
      }
    }

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.kinesis_firehose_stream_logging_group.name
      log_stream_name = aws_cloudwatch_log_stream.kinesis_firehose_stream_logging_stream.name
    }
  }
}

output "kinesis_firehose_stream_arn" {
  value = aws_kinesis_firehose_delivery_stream.kinesis_firehose_stream.arn
}

locals {
  stream_name = "cavl-kinesis-firehose-stream-${var.environment}"
}
