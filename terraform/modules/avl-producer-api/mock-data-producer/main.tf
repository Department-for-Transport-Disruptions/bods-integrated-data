terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_avl_mock_data_producer_send_data" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "avl-mock-data-producer-send-data"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-mock-data-producer-send-data.zip"
  handler       = "index.handler"
  memory        = 1024
  runtime       = "nodejs20.x"
  timeout       = 120
  schedule      = "rate(1 minute)"

  env_vars = {
    STAGE         = var.environment
    DATA_ENDPOINT = var.environment == "local" ? var.avl_consumer_data_endpoint_url_local : aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].api_endpoint
  }
}


module "integrated_data_avl_mock_data_producer_subscribe" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "avl-mock-data-producer-subscribe"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-mock-data-producer-subscribe.zip"
  handler       = "index.handler"
  memory        = 1024
  runtime       = "nodejs20.x"
  timeout       = 120
}

resource "aws_lambda_function_url" "integrated_data_mock_avl_producer_function_url" {
  count              = var.environment == "local" ? 1 : 0
  function_name      = module.integrated_data_avl_mock_data_producer_subscribe.function_name
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_api" "integrated_data_mock_avl_producer_api" {
  count         = var.environment == "local" ? 0 : 1
  name          = "integrated-data-mock-avl-producer-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "integrated_data_avl_mock_producer_api_integration_subscribe" {
  count                  = var.environment == "local" ? 0 : 1
  api_id                 = aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.integrated_data_avl_mock_data_producer_subscribe.function_name
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "integrated_data_avl__mock_data_producer_api_route_subscribe" {
  count     = var.environment == "local" ? 0 : 1
  api_id    = aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].id
  route_key = "POST /subscribe"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_avl_mock_producer_api_integration_subscribe[0].id}"
}


resource "aws_apigatewayv2_deployment" "integrated_data_avl_mock_data_producer_api_deployment" {
  count       = var.environment == "local" ? 0 : 1
  api_id      = aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].id
  description = aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].name

  depends_on = [
    aws_apigatewayv2_route.integrated_data_avl__mock_data_producer_api_route_subscribe[0]
  ]

  lifecycle {
    create_before_destroy = true
  }
}

output "function_url" {
  description = "Function URL for subscribe lambda for local deployment"
  value       = var.environment == "local" ? aws_lambda_function_url.integrated_data_mock_avl_producer_function_url[0].function_url : null
}

output "endpoint" {
  description = "HTTP API endpoint URL"
  value       = var.environment == "local" ? null : aws_apigatewayv2_api.integrated_data_mock_avl_producer_api[0].api_endpoint
}
