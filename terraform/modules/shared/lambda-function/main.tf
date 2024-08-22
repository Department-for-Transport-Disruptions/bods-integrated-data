terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

locals {
  source_code_hash = (fileexists(var.zip_path) ? filebase64sha256(var.zip_path) :
  data.aws_lambda_function.existing_function[0].source_code_hash)
  function_name = "${var.function_name}-${var.environment}"
}

data "aws_lambda_function" "existing_function" {
  count         = fileexists(var.zip_path) ? 0 : 1
  function_name = local.function_name
}

resource "aws_security_group" "db_sg" {
  count  = var.needs_db_access ? 1 : 0
  name   = "${var.function_name}-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "db_sg_allow_all_egress_ipv4" {
  count             = var.needs_db_access ? 1 : 0
  security_group_id = aws_security_group.db_sg[0].id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "db_sg_allow_all_egress_ipv6" {
  count             = var.needs_db_access ? 1 : 0
  security_group_id = aws_security_group.db_sg[0].id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "db_sg_allow_lambda_ingress" {
  count                        = var.needs_db_access ? 1 : 0
  security_group_id            = var.database_sg_id
  referenced_security_group_id = aws_security_group.db_sg[0].id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

resource "aws_iam_policy" "lambda_policy" {
  count = var.permissions != null ? 1 : 0

  name = "${var.function_name}-policy-${var.environment}"
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = var.permissions
  })
}

resource "aws_iam_role" "lambda_role" {
  name = "${var.function_name}-role-${var.environment}"

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

  inline_policy {
    name = "put-metrics-policy"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Action = [
            "cloudwatch:PutMetricData"
          ],
          Effect   = "Allow",
          Resource = "*"
        }
      ]
    })
  }
}

resource "aws_iam_role_policy_attachment" "lambda_role_lambda_policy_attachment" {
  role = aws_iam_role.lambda_role.id
  policy_arn = (var.subnet_ids != null ? "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole" :
  "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole")
}

resource "aws_iam_role_policy_attachment" "lambda_role_custom_policy_attachment" {
  count = var.permissions != null ? 1 : 0

  role       = aws_iam_role.lambda_role.id
  policy_arn = aws_iam_policy.lambda_policy[0].arn
}

resource "aws_lambda_function" "function" {
  function_name    = local.function_name
  filename         = var.zip_path
  role             = aws_iam_role.lambda_role.arn
  handler          = var.handler
  source_code_hash = local.source_code_hash
  architectures    = var.architectures

  runtime     = var.runtime
  timeout     = var.timeout
  memory_size = var.memory

  reserved_concurrent_executions = var.reserved_concurrency != null ? var.reserved_concurrency : null

  dynamic "vpc_config" {
    for_each = var.needs_db_access || var.needs_vpc_access ? [1] : []

    content {
      subnet_ids = var.subnet_ids
      security_group_ids = var.needs_db_access ? [
        aws_security_group.db_sg[0].id
      ] : [var.custom_sg_id]
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

resource "aws_lambda_function_event_invoke_config" "retry_config" {
  function_name          = aws_lambda_function.function.function_name
  maximum_retry_attempts = var.retry_attempts
}

output "lambda_arn" {
  value = aws_lambda_function.function.arn
}
