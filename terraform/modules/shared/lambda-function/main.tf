terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

locals {
  source_code_hash = fileexists(var.zip_path) ? filebase64sha256(var.zip_path) : data.aws_lambda_function.existing_function[0].source_code_hash
}

data "aws_lambda_function" "existing_function" {
  count         = fileexists(var.zip_path) ? 0 : 1
  function_name = var.function_name
}

resource "aws_lambda_function" "function" {
  function_name    = var.function_name
  filename         = var.zip_path
  role             = var.role_arn
  handler          = var.handler
  source_code_hash = local.source_code_hash

  runtime     = var.runtime
  timeout     = var.timeout
  memory_size = var.memory

  dynamic "vpc_config" {
    for_each = var.security_group_ids != null && var.subnet_ids != null ? [1] : []

    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  dynamic "environment" {
    for_each = var.env_vars != null ? [1] : []

    content {
      variables = var.env_vars
    }
  }
}

resource "aws_cloudwatch_event_rule" "schedule" {
  count               = var.schedule != null ? 1 : 0
  name                = "schedule-${aws_lambda_function.function.function_name}"
  description         = "Schedule for ${aws_lambda_function.function.function_name}"
  schedule_expression = var.schedule
}

resource "aws_cloudwatch_event_target" "schedule_lambda" {
  count = var.schedule != null ? 1 : 0
  rule  = aws_cloudwatch_event_rule.schedule[0].name
  arn   = aws_lambda_function.function.arn
}


resource "aws_lambda_permission" "allow_events_bridge_to_run_lambda" {
  count         = var.schedule != null ? 1 : 0
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule[0].arn
}

resource "aws_lambda_permission" "allow_bucket_trigger" {
  count         = var.s3_bucket_trigger != null ? 1 : 0
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.s3_bucket_trigger.arn
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  count  = var.s3_bucket_trigger != null ? 1 : 0
  bucket = var.s3_bucket_trigger.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.function.arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_lambda_permission.allow_bucket_trigger]
}
