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
  siri_vm_downloader_request_parameters = [
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
  avl_consumer_subscriber_request_parameters = [
    "method.request.querystring.boundingBox",
    "method.request.querystring.operatorRef",
    "method.request.querystring.vehicleRef",
    "method.request.querystring.lineRef",
    "method.request.querystring.producerRef",
    "method.request.querystring.originRef",
    "method.request.querystring.destinationRef",
    "method.request.querystring.subscriptionId"
  ]
  avl_consumer_subscriptions_request_parameters = [
    "method.request.querystring.subscriptionId"
  ]
  siri_sx_downloader_request_parameters = [
    "method.request.querystring.subscriptionId"
  ]
  gtfs_downloader_request_parameters = [
    "method.request.querystring.regionCode",
    "method.request.querystring.regionName"
  ]
  gtfs_rt_downloader_request_parameters = [
    "method.request.querystring.routeId",
    "method.request.querystring.startTimeBefore",
    "method.request.querystring.startTimeAfter",
    "method.request.querystring.boundingBox",
  ]
}

resource "aws_api_gateway_rest_api" "siri_consumer_api" {
  name = "${var.api_name}-${var.environment}"

  binary_media_types = ["application/x-protobuf"]

  endpoint_configuration {
    types = [var.private ? "PRIVATE" : "REGIONAL"]
  }
}

resource "aws_cloudwatch_log_group" "siri_consumer_api_log_group" {
  name              = "${var.api_name}-${var.environment}"
  retention_in_days = var.environment == "prod" ? 90 : 30
}

resource "aws_api_gateway_stage" "siri_consumer_api_stage" {
  rest_api_id           = aws_api_gateway_rest_api.siri_consumer_api.id
  deployment_id         = aws_api_gateway_deployment.siri_consumer_api_deployment.id
  stage_name            = "v1"
  cache_cluster_enabled = true
  cache_cluster_size    = var.environment == "prod" ? 1.6 : 0.5

  dynamic "access_log_settings" {
    for_each = var.environment != "local" ? ["apply"] : []

    content {
      destination_arn = aws_cloudwatch_log_group.siri_consumer_api_log_group.arn
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

data "aws_iam_policy_document" "siri_consumer_api_policy" {
  count = var.private ? 1 : 0

  statement {
    actions = [
      "execute-api:Invoke"
    ]

    resources = [
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}${aws_api_gateway_resource.siri_vm_api_stats_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_subscriber_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_unsubscriber_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_subscriptions_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_sx_downloader_method.http_method}${aws_api_gateway_resource.siri_sx_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_downloader_method.http_method}${aws_api_gateway_resource.gtfs_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_region_retriever_method.http_method}${aws_api_gateway_resource.gtfs_region_retriever_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_rt_downloader_method.http_method}${aws_api_gateway_resource.gtfs_rt_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_rt_service_alerts_downloader_method.http_method}${aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.path}"
    ]

    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "StringNotEquals"
      variable = "aws:sourceVpce"
      values   = var.external_vpces
    }
  }

  statement {
    actions = [
      "execute-api:Invoke"
    ]

    resources = [
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}${aws_api_gateway_resource.siri_vm_api_stats_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_subscriber_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_unsubscriber_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_subscriptions_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_sx_downloader_method.http_method}${aws_api_gateway_resource.siri_sx_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_downloader_method.http_method}${aws_api_gateway_resource.gtfs_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_region_retriever_method.http_method}${aws_api_gateway_resource.gtfs_region_retriever_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_rt_downloader_method.http_method}${aws_api_gateway_resource.gtfs_rt_downloader_resource.path}",
      "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_rt_service_alerts_downloader_method.http_method}${aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.path}"
    ]

    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }
  }
}

resource "aws_api_gateway_rest_api_policy" "siri_consumer_api_resource_policy" {
  count = var.private ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  policy      = data.aws_iam_policy_document.siri_consumer_api_policy[0].json
}

resource "aws_api_gateway_deployment" "siri_consumer_api_deployment" {
  triggers = {
    redeployment = sha1(join(",", tolist([
      jsonencode(aws_api_gateway_integration.siri_vm_api_downloader_integration),
      jsonencode(aws_api_gateway_integration.avl_consumer_subscriber_integration),
      jsonencode(aws_api_gateway_integration.avl_consumer_unsubscriber_integration),
      jsonencode(aws_api_gateway_integration.avl_consumer_subscriptions_integration),
      jsonencode(aws_api_gateway_integration.siri_vm_api_stats_integration),
      jsonencode(aws_api_gateway_integration.siri_sx_downloader_integration),
      jsonencode(aws_api_gateway_integration.gtfs_downloader_integration),
      jsonencode(aws_api_gateway_integration.gtfs_region_retriever_integration),
      jsonencode(aws_api_gateway_integration.gtfs_rt_downloader_integration),
      jsonencode(aws_api_gateway_integration_response.gtfs_rt_downloader_200_integration_response),
      jsonencode(aws_api_gateway_integration_response.gtfs_rt_downloader_400_integration_response),
      jsonencode(aws_api_gateway_integration.gtfs_rt_service_alerts_downloader_integration),
      jsonencode(aws_api_gateway_integration_response.gtfs_rt_service_alerts_downloader_integration_response),
      jsonencode(aws_api_gateway_rest_api.siri_consumer_api.body),
      var.private ? jsonencode(data.aws_iam_policy_document.siri_consumer_api_policy[0]) : jsonencode("")
    ])))
  }

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_resource" "siri_vm_api_downloader_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_rest_api.siri_consumer_api.root_resource_id
  path_part   = "siri-vm"
}

resource "aws_api_gateway_method" "siri_vm_api_downloader_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.siri_vm_api_downloader_resource.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    for param in local.siri_vm_downloader_request_parameters : param => false
  }
}

resource "aws_api_gateway_method_settings" "siri_vm_api_downloader_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.siri_vm_api_downloader_resource.path_part}/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 5
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "siri_vm_api_downloader_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.siri_vm_api_downloader_resource.id
  http_method             = aws_api_gateway_method.siri_vm_api_downloader_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.siri_vm_downloader_invoke_arn

  cache_key_parameters = local.siri_vm_downloader_request_parameters
}

resource "aws_lambda_permission" "siri_vm_api_downloader_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.siri_vm_downloader_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}"
}

resource "aws_api_gateway_resource" "siri_vm_api_stats_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_rest_api.siri_consumer_api.root_resource_id
  path_part   = "stats"
}

resource "aws_api_gateway_method" "siri_vm_api_stats_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.siri_vm_api_stats_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method_settings" "siri_vm_api_stats_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.siri_vm_api_stats_resource.path_part}/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 5
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "siri_vm_api_stats_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.siri_vm_api_stats_resource.id
  http_method             = aws_api_gateway_method.siri_vm_api_stats_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.siri_vm_stats_invoke_arn
}

resource "aws_lambda_permission" "siri_vm_api_stats_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.siri_vm_stats_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_vm_api_stats_method.http_method}${aws_api_gateway_resource.siri_vm_api_stats_resource.path}"
}

resource "aws_api_gateway_resource" "avl_consumer_subscriptions_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_resource.siri_vm_api_downloader_resource.id
  path_part   = "subscriptions"
}

resource "aws_api_gateway_method" "avl_consumer_subscriber_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.avl_consumer_subscriptions_resource.id
  http_method   = "POST"
  authorization = "NONE"

  request_parameters = {
    for param in local.avl_consumer_subscriber_request_parameters : param => false
  }
}

resource "aws_api_gateway_method_settings" "avl_consumer_subscriber_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path_part}/${aws_api_gateway_method.avl_consumer_subscriber_method.http_method}"

  settings {
    caching_enabled = false
    metrics_enabled = true
    logging_level   = "INFO"
  }
}

resource "aws_api_gateway_integration" "avl_consumer_subscriber_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.avl_consumer_subscriptions_resource.id
  http_method             = aws_api_gateway_method.avl_consumer_subscriber_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.avl_consumer_subscriber_invoke_arn
}

resource "aws_lambda_permission" "avl_consumer_subscriber_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.avl_consumer_subscriber_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_subscriber_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}"
}

resource "aws_api_gateway_method" "avl_consumer_unsubscriber_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.avl_consumer_subscriptions_resource.id
  http_method   = "DELETE"
  authorization = "NONE"
}

resource "aws_api_gateway_method_settings" "avl_consumer_unsubscriber_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path_part}/${aws_api_gateway_method.avl_consumer_unsubscriber_method.http_method}"

  settings {
    caching_enabled = false
    metrics_enabled = true
    logging_level   = "INFO"
  }
}

resource "aws_api_gateway_integration" "avl_consumer_unsubscriber_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.avl_consumer_subscriptions_resource.id
  http_method             = aws_api_gateway_method.avl_consumer_unsubscriber_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.avl_consumer_unsubscriber_invoke_arn
}

resource "aws_lambda_permission" "avl_consumer_unsubscriber_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.avl_consumer_unsubscriber_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_unsubscriber_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}"
}

resource "aws_api_gateway_method" "avl_consumer_subscriptions_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.avl_consumer_subscriptions_resource.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    for param in local.avl_consumer_subscriptions_request_parameters : param => false
  }
}

resource "aws_api_gateway_method_settings" "avl_consumer_subscriptions_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path_part}/${aws_api_gateway_method.avl_consumer_subscriptions_method.http_method}"

  settings {
    caching_enabled = false
    metrics_enabled = true
    logging_level   = "INFO"
  }
}

resource "aws_api_gateway_integration" "avl_consumer_subscriptions_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.avl_consumer_subscriptions_resource.id
  http_method             = aws_api_gateway_method.avl_consumer_subscriptions_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.avl_consumer_subscriptions_invoke_arn
}

resource "aws_lambda_permission" "avl_consumer_subscriptions_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.avl_consumer_subscriptions_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.avl_consumer_subscriptions_method.http_method}${aws_api_gateway_resource.avl_consumer_subscriptions_resource.path}"
}

resource "aws_api_gateway_resource" "siri_sx_downloader_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_rest_api.siri_consumer_api.root_resource_id
  path_part   = "siri-sx"
}

resource "aws_api_gateway_method" "siri_sx_downloader_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.siri_sx_downloader_resource.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    for param in local.siri_sx_downloader_request_parameters : param => false
  }
}

resource "aws_api_gateway_method_settings" "siri_sx_downloader_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.siri_sx_downloader_resource.path_part}/${aws_api_gateway_method.siri_sx_downloader_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 5
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "siri_sx_downloader_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.siri_sx_downloader_resource.id
  http_method             = aws_api_gateway_method.siri_sx_downloader_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.siri_sx_downloader_invoke_arn

  cache_key_parameters = local.siri_sx_downloader_request_parameters
}

resource "aws_lambda_permission" "siri_sx_downloader_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.siri_sx_downloader_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.siri_sx_downloader_method.http_method}${aws_api_gateway_resource.siri_sx_downloader_resource.path}"
}

resource "aws_api_gateway_resource" "gtfs_downloader_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_rest_api.siri_consumer_api.root_resource_id
  path_part   = "gtfs"
}

resource "aws_api_gateway_method" "gtfs_downloader_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.gtfs_downloader_resource.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    for param in local.gtfs_downloader_request_parameters : param => false
  }
}

resource "aws_api_gateway_method_settings" "gtfs_downloader_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.gtfs_downloader_resource.path_part}/${aws_api_gateway_method.gtfs_downloader_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 3600
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "gtfs_downloader_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.gtfs_downloader_resource.id
  http_method             = aws_api_gateway_method.gtfs_downloader_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.gtfs_downloader_invoke_arn

  cache_key_parameters = local.gtfs_downloader_request_parameters
}

resource "aws_lambda_permission" "gtfs_downloader_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.gtfs_downloader_lambda_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_downloader_method.http_method}${aws_api_gateway_resource.gtfs_downloader_resource.path}"
}

resource "aws_api_gateway_resource" "gtfs_region_retriever_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_resource.gtfs_downloader_resource.id
  path_part   = "regions"
}

resource "aws_api_gateway_method" "gtfs_region_retriever_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.gtfs_region_retriever_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method_settings" "gtfs_region_retriever_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.gtfs_downloader_resource.path_part}/${aws_api_gateway_resource.gtfs_region_retriever_resource.path_part}/${aws_api_gateway_method.gtfs_region_retriever_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 3600
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "gtfs_region_retriever_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.gtfs_region_retriever_resource.id
  http_method             = aws_api_gateway_method.gtfs_region_retriever_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.gtfs_region_retriever_invoke_arn
}

resource "aws_lambda_permission" "gtfs_region_retriever_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.gtfs_region_retriever_lambda_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_region_retriever_method.http_method}${aws_api_gateway_resource.gtfs_region_retriever_resource.path}"
}

resource "aws_api_gateway_resource" "gtfs_rt_downloader_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_rest_api.siri_consumer_api.root_resource_id
  path_part   = "gtfs-rt"
}

resource "aws_api_gateway_method" "gtfs_rt_downloader_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.gtfs_rt_downloader_resource.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    for param in local.gtfs_rt_downloader_request_parameters : param => false
  }
}

resource "aws_api_gateway_method_settings" "gtfs_rt_downloader_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.gtfs_rt_downloader_resource.path_part}/${aws_api_gateway_method.gtfs_rt_downloader_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 5
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "gtfs_rt_downloader_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.gtfs_rt_downloader_resource.id
  http_method             = aws_api_gateway_method.gtfs_rt_downloader_method.http_method
  integration_http_method = "POST"
  type                    = "AWS"
  uri                     = var.gtfs_rt_downloader_invoke_arn
  passthrough_behavior    = "WHEN_NO_TEMPLATES"

  request_templates = {
    "application/json" = <<EOF
{
  "queryStringParameters": {
    #foreach($param in $input.params().querystring.keySet())
    "$param": "$util.escapeJavaScript($input.params().querystring.get($param))" #if($foreach.hasNext),#end

    #end
  }
}

EOF
  }

  cache_key_parameters = local.gtfs_rt_downloader_request_parameters
}

resource "aws_api_gateway_integration_response" "gtfs_rt_downloader_200_integration_response" {
  rest_api_id      = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id      = aws_api_gateway_resource.gtfs_rt_downloader_resource.id
  http_method      = aws_api_gateway_method.gtfs_rt_downloader_method.http_method
  status_code      = "200"
  content_handling = "CONVERT_TO_BINARY"

  response_parameters = {
    "method.response.header.Content-Type"     = "'application/x-protobuf'"
    "method.response.header.Content-Encoding" = "'gzip'"
  }

  depends_on = [aws_api_gateway_integration.gtfs_rt_downloader_integration]
}

resource "aws_api_gateway_integration_response" "gtfs_rt_downloader_400_integration_response" {
  rest_api_id       = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id       = aws_api_gateway_resource.gtfs_rt_downloader_resource.id
  http_method       = aws_api_gateway_method.gtfs_rt_downloader_method.http_method
  status_code       = "400"
  selection_pattern = "\\[400\\].*"

  response_templates = {
    "application/json" = <<EOF
#set($inputRoot = $util.parseJson($input.body))
{
    "message": "$inputRoot.errorMessage"
}

EOF
  }

  depends_on = [aws_api_gateway_integration.gtfs_rt_downloader_integration, aws_api_gateway_method_response.gtfs_rt_downloader_200_method_response, aws_api_gateway_method_response.gtfs_rt_downloader_400_method_response]
}

resource "aws_api_gateway_method_response" "gtfs_rt_downloader_200_method_response" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id = aws_api_gateway_resource.gtfs_rt_downloader_resource.id
  http_method = aws_api_gateway_method.gtfs_rt_downloader_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Content-Type"     = false
    "method.response.header.Content-Encoding" = false
  }
}

resource "aws_api_gateway_method_response" "gtfs_rt_downloader_400_method_response" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id = aws_api_gateway_resource.gtfs_rt_downloader_resource.id
  http_method = aws_api_gateway_method.gtfs_rt_downloader_method.http_method
  status_code = "400"

  response_models = {
    "application/json" = "Error"
  }

  response_parameters = {
    "method.response.header.Content-Type" = false
  }
}

resource "aws_lambda_permission" "gtfs_rt_downloader_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.gtfs_rt_downloader_lambda_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_rt_downloader_method.http_method}${aws_api_gateway_resource.gtfs_rt_downloader_resource.path}"
}

resource "aws_api_gateway_resource" "gtfs_rt_service_alerts_downloader_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  parent_id   = aws_api_gateway_resource.gtfs_rt_downloader_resource.id
  path_part   = "service-alerts"
}

resource "aws_api_gateway_method" "gtfs_rt_service_alerts_downloader_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id   = aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_method_settings" "gtfs_rt_service_alerts_downloader_method_settings" {
  count = var.environment == "local" ? 0 : 1

  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  stage_name  = aws_api_gateway_stage.siri_consumer_api_stage.stage_name
  method_path = "${aws_api_gateway_resource.gtfs_rt_downloader_resource.path_part}/${aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.path_part}/${aws_api_gateway_method.gtfs_rt_service_alerts_downloader_method.http_method}"

  settings {
    caching_enabled      = true
    cache_ttl_in_seconds = 60
    metrics_enabled      = true
    logging_level        = "INFO"
  }
}

resource "aws_api_gateway_integration" "gtfs_rt_service_alerts_downloader_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id             = aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.id
  http_method             = aws_api_gateway_method.gtfs_rt_service_alerts_downloader_method.http_method
  integration_http_method = "POST"
  type                    = "AWS"
  uri                     = var.gtfs_rt_service_alerts_downloader_invoke_arn
  passthrough_behavior    = "WHEN_NO_TEMPLATES"

  request_templates = {
    "application/json" = <<EOF
{
  "queryStringParameters": {
    #foreach($param in $input.params().querystring.keySet())
    "$param": "$util.escapeJavaScript($input.params().querystring.get($param))" #if($foreach.hasNext),#end

    #end
  }
}

EOF
  }
}

resource "aws_api_gateway_integration_response" "gtfs_rt_service_alerts_downloader_integration_response" {
  rest_api_id      = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id      = aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.id
  http_method      = aws_api_gateway_method.gtfs_rt_service_alerts_downloader_method.http_method
  status_code      = "200"
  content_handling = "CONVERT_TO_BINARY"

  response_parameters = {
    "method.response.header.Content-Type"     = "'application/x-protobuf'"
    "method.response.header.Content-Encoding" = "'gzip'"
  }

  depends_on = [aws_api_gateway_integration.gtfs_rt_service_alerts_downloader_integration, aws_api_gateway_method_response.gtfs_rt_service_alerts_downloader_method_response]
}

resource "aws_api_gateway_method_response" "gtfs_rt_service_alerts_downloader_method_response" {
  rest_api_id = aws_api_gateway_rest_api.siri_consumer_api.id
  resource_id = aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.id
  http_method = aws_api_gateway_method.gtfs_rt_service_alerts_downloader_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Content-Type"     = false
    "method.response.header.Content-Encoding" = false
  }
}

resource "aws_lambda_permission" "gtfs_rt_service_alerts_downloader_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.gtfs_rt_service_alerts_downloader_lambda_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_consumer_api.id}/*/${aws_api_gateway_method.gtfs_rt_service_alerts_downloader_method.http_method}${aws_api_gateway_resource.gtfs_rt_service_alerts_downloader_resource.path}"
}
