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
