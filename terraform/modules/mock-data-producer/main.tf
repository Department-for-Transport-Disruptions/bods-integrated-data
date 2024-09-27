terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

module "integrated_data_mock_data_producer_send_data" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-mock-data-producer-send-data"
  zip_path      = "${path.module}/../../../src/functions/dist/mock-data-producer-send-data.zip"
  handler       = "index.handler"
  memory        = 256
  runtime       = "nodejs20.x"
  timeout       = 120
  schedule      = "rate(1 minute)"

  permissions = [
    {
      Action = [
        "dynamodb:Scan",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}",
      ]
    }
  ]

  env_vars = {
    STAGE         = var.environment
    DATA_ENDPOINT = var.avl_consumer_data_endpoint
    TABLE_NAME    = var.avl_subscription_table_name
  }
}

module "integrated_data_mock_data_producer_send_heartbeat" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-mock-producer-send-heartbeat"
  zip_path      = "${path.module}/../../../src/functions/dist/mock-data-producer-send-heartbeat.zip"
  handler       = "index.handler"
  memory        = 256
  runtime       = "nodejs20.x"
  timeout       = 120
  schedule      = "rate(1 minute)"

  permissions = [
    {
      Action = [
        "dynamodb:Scan",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}",
      ]
    }
  ]

  env_vars = {
    STAGE         = var.environment
    DATA_ENDPOINT = var.avl_consumer_data_endpoint
    TABLE_NAME    = var.avl_subscription_table_name
  }
}

module "integrated_data_mock_data_producer_subscribe" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-mock-data-producer-subscribe"
  zip_path      = "${path.module}/../../../src/functions/dist/mock-data-producer-subscribe.zip"
  handler       = "index.handler"
  memory        = 1024
  runtime       = "nodejs20.x"
  timeout       = 120
}

resource "aws_lambda_function_url" "integrated_data_mock_producer_subscribe_function_url" {
  count              = var.environment == "local" ? 1 : 0
  function_name      = module.integrated_data_mock_data_producer_subscribe.function_name
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_api" "integrated_data_mock_producer_api" {
  count         = var.environment == "local" ? 0 : 1
  name          = "integrated-data-mock-producer-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "integrated_data_mock_producer_api_stage" {
  count       = var.environment == "local" ? 0 : 1
  api_id      = aws_apigatewayv2_api.integrated_data_mock_producer_api[0].id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 15000
  }
}

resource "aws_apigatewayv2_integration" "integrated_data_mock_producer_api_integration_subscribe" {
  count                  = var.environment == "local" ? 0 : 1
  api_id                 = aws_apigatewayv2_api.integrated_data_mock_producer_api[0].id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.integrated_data_mock_data_producer_subscribe.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "integrated_data_mock_data_producer_api_route_subscribe" {
  count     = var.environment == "local" ? 0 : 1
  api_id    = aws_apigatewayv2_api.integrated_data_mock_producer_api[0].id
  route_key = "POST /subscriptions"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_mock_producer_api_integration_subscribe[0].id}"
}


resource "aws_apigatewayv2_deployment" "integrated_data_mock_data_producer_api_deployment" {
  count       = var.environment == "local" ? 0 : 1
  api_id      = aws_apigatewayv2_api.integrated_data_mock_producer_api[0].id
  description = aws_apigatewayv2_api.integrated_data_mock_producer_api[0].name

  triggers = {
    redeployment = sha1(join(",", tolist([
      jsonencode(aws_apigatewayv2_route.integrated_data_mock_data_producer_api_route_subscribe),
      jsonencode(aws_apigatewayv2_integration.integrated_data_mock_producer_api_integration_subscribe),
            jsonencode(aws_apigatewayv2_route.integrated_data_avl_mock_data_receiver_route),
      jsonencode(aws_apigatewayv2_integration.integrated_data_avl_mock_data_receiver_integration),
    ])))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lambda_permission" "integrated_data_mock_producer_api_subscribe_permissions" {
  count         = var.environment == "local" ? 0 : 1
  function_name = module.integrated_data_mock_data_producer_subscribe.function_name
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.integrated_data_mock_producer_api[0].execution_arn}/${aws_apigatewayv2_stage.integrated_data_mock_producer_api_stage[0].name}/*"
}

output "subscribe_function_url" {
  description = "Function URL for subscribe lambda for local deployment"
  value = (var.environment == "local" ?
  aws_lambda_function_url.integrated_data_mock_producer_subscribe_function_url[0].function_url : null)
}

output "endpoint" {
  description = "HTTP API endpoint URL"
  value = (var.environment == "local" ? null :
  aws_apigatewayv2_api.integrated_data_mock_producer_api[0].api_endpoint)
}

module "avl_mock_data_receiver" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-mock-data-receiver"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-mock-data-receiver.zip"
  handler       = "index.handler"
  memory        = 128
  runtime       = "nodejs20.x"
  timeout       = 60
}

resource "aws_lambda_function_url" "avl_mock_data_receiver_url" {
  count = var.environment == "local" ? 1 : 0

  function_name      = module.avl_mock_data_receiver.function_name
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_integration" "integrated_data_avl_mock_data_receiver_integration" {
  count                  = var.environment == "local" ? 0 : 1
  api_id                 = aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.avl_mock_data_receiver.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "integrated_data_avl_mock_data_receiver_route" {
  count     = var.environment == "local" ? 0 : 1
  api_id    = aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].id
  route_key = "POST /data"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_avl_mock_data_receiver_integration[0].id}"
}

resource "aws_lambda_permission" "integrated_data_avl_mock_data_receiver_permissions" {
  count         = var.environment == "local" ? 0 : 1
  function_name = module.avl_mock_data_receiver.function_name
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].execution_arn}/${aws_apigatewayv2_stage.integrated_data_mock_avl_producer_api_stage[0].name}/*"
}
