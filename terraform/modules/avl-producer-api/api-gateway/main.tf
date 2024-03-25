terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_apigatewayv2_api" "integrated_data_avl_producer_api" {
  name          = "integrated-data-avl-producer-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "integrated_data_avl_producer_api_integration_subscribe" {
  api_id                 = aws_apigatewayv2_api.integrated_data_avl_producer_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.subscribe_lambda_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "integrated_data_avl_producer_api_integration_data" {
  api_id                 = aws_apigatewayv2_api.integrated_data_avl_producer_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.data_endpoint_lambda_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "integrated_data_avl_producer_api_route_data" {
  api_id    = aws_apigatewayv2_api.integrated_data_avl_producer_api.id
  route_key = "POST /data/{subscription_id}"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_avl_producer_api_integration_data.id}"
}

resource "aws_apigatewayv2_route" "integrated_data_avl_producer_api_route_subscribe" {
  api_id    = aws_apigatewayv2_api.integrated_data_avl_producer_api.id
  route_key = "POST /subscribe"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_avl_producer_api_integration_subscribe.id}"
}


resource "aws_apigatewayv2_deployment" "integrated_data_avl_producer_api_deployment" {
  api_id      = aws_apigatewayv2_api.integrated_data_avl_producer_api.id
  description = aws_apigatewayv2_api.integrated_data_avl_producer_api.name

  depends_on = [
    aws_apigatewayv2_route.integrated_data_avl_producer_api_route_data,
    aws_apigatewayv2_route.integrated_data_avl_producer_api_route_subscribe
  ]

  lifecycle {
    create_before_destroy = true
  }
}

output "endpoint" {
  description = "HTTP API endpoint URL"
  value       = aws_apigatewayv2_api.integrated_data_avl_producer_api.api_endpoint
}
