terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_api_gateway_rest_api" "siri_vm_api" {
  name = "${var.api_name}-${var.environment}"

  endpoint_configuration {
    types = [var.private ? "PRIVATE" : "REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "siri_vm_api_downloader_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  parent_id   = aws_api_gateway_rest_api.siri_vm_api.root_resource_id
  path_part   = "siri-vm"
}

resource "aws_api_gateway_method" "siri_vm_api_downloader_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_vm_api.id
  resource_id   = aws_api_gateway_resource.siri_vm_api_downloader_resource.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    for param in local.request_parameters : param => false
  }
}

resource "aws_api_gateway_method_settings" "siri_vm_api_downloader_method_settings" {
  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  stage_name  = aws_api_gateway_stage.siri_vm_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.siri_vm_api_downloader_resource.path_part}/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 5
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "siri_vm_api_downloader_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_vm_api.id
  resource_id             = aws_api_gateway_resource.siri_vm_api_downloader_resource.id
  http_method             = aws_api_gateway_method.siri_vm_api_downloader_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.siri_vm_downloader_invoke_arn

  cache_key_parameters = local.request_parameters
}

resource "aws_api_gateway_resource" "siri_vm_api_stats_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  parent_id   = aws_api_gateway_rest_api.siri_vm_api.root_resource_id
  path_part   = "stats"
}

resource "aws_api_gateway_method" "siri_vm_api_stats_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_vm_api.id
  resource_id   = aws_api_gateway_resource.siri_vm_api_stats_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method_settings" "siri_vm_api_stats_method_settings" {
  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  stage_name  = aws_api_gateway_stage.siri_vm_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.siri_vm_api_stats_resource.path_part}/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 5
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "siri_vm_api_stats_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_vm_api.id
  resource_id             = aws_api_gateway_resource.siri_vm_api_stats_resource.id
  http_method             = aws_api_gateway_method.siri_vm_api_stats_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.siri_vm_stats_invoke_arn
}

resource "aws_api_gateway_deployment" "siri_vm_api_deployment" {
  triggers = {
    redeployment = sha1(join(",", tolist([
      jsonencode(aws_api_gateway_integration.siri_vm_api_downloader_integration),
      jsonencode(aws_api_gateway_integration.siri_vm_api_stats_integration),
      jsonencode(aws_api_gateway_rest_api.siri_vm_api.body),
      var.private ? jsonencode(aws_api_gateway_rest_api_policy.siri_vm_api_resource_policy[0].policy) : ""
    ])))
  }

  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lambda_permission" "siri_vm_downloader_api_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.siri_vm_downloader_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}"
}

resource "aws_lambda_permission" "siri_vm_stats_api_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.siri_vm_stats_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}${aws_api_gateway_resource.siri_vm_api_stats_resource.path}"
}

resource "aws_cloudwatch_log_group" "siri_vm_api_log_group" {
  name              = "${var.api_name}-${var.environment}"
  retention_in_days = var.environment == "prod" ? 90 : 30
}

resource "aws_api_gateway_stage" "siri_vm_api_stage" {
  rest_api_id           = aws_api_gateway_rest_api.siri_vm_api.id
  deployment_id         = aws_api_gateway_deployment.siri_vm_api_deployment.id
  stage_name            = "v1"
  cache_cluster_enabled = true
  cache_cluster_size    = var.environment == "prod" ? 1.6 : 0.5

  dynamic "access_log_settings" {
    for_each = var.environment != "local" ? ["apply"] : []

    content {
      destination_arn = aws_cloudwatch_log_group.siri_vm_api_log_group.arn
      format = jsonencode({
        requestId         = "$context.requestId"
        extendedRequestId = "$context.extendedRequestId"
        ip                = "$context.identity.sourceIp"
        caller            = "$context.identity.caller"
        user              = "$context.identity.user"
        requestTime       = "$context.requestTime"
        requestTimeEpoch  = "$context.requestTimeEpoch"
        resourcePath      = "$context.resourcePath"
        httpMethod        = "$context.httpMethod"
        status            = "$context.status"
        protocol          = "$context.protocol"
        responseLength    = "$context.responseLength"
      })
    }
  }
}

resource "aws_api_gateway_rest_api_policy" "siri_vm_api_resource_policy" {
  count = var.private ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  policy = jsonencode({
    Version = "2008-10-17"
    Statement = [
      {
        "Effect" : "Deny",
        "Principal" : "*",
        "Action" : "execute-api:Invoke",
        "Resource" : [
          "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}",
          "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}${aws_api_gateway_resource.siri_vm_api_stats_resource.path}"
        ],
        "Condition" : {
          "StringNotEquals" : {
            "aws:sourceVpce" : var.external_vpces_for_sirivm_api
          }
        }
      },
      {
        "Effect" : "Allow",
        "Principal" : "*",
        "Action" : "execute-api:Invoke",
        "Resource" : [
          "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}",
          "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}${aws_api_gateway_resource.siri_vm_api_stats_resource.path}"
        ]
      }
    ]
  })
}

locals {
  request_parameters = [
    "method.request.querystring.downloadTfl",
    "method.request.querystring.boundingBox",
    "method.request.querystring.operatorRef",
    "method.request.querystring.vehicleRef",
    "method.request.querystring.lineRef",
    "method.request.querystring.producerRef",
    "method.request.querystring.originRef",
    "method.request.querystring.destinationRef",
    "method.request.querystring.subscriptionId"
  ]
}
