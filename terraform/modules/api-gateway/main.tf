terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_apigatewayv2_api" "bods_integrated_data_api" {
  name          = "bods-integrated-data-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "bods_integrated_data_api_integration" {
  api_id                 = aws_apigatewayv2_api.bods_integrated_data_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.lambda_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "bods_integrated_data_api_route" {
  api_id    = aws_apigatewayv2_api.bods_integrated_data_api.id
  route_key = "POST /data/{subscription_id}"
  target    = "integrations/${aws_apigatewayv2_integration.bods_integrated_data_api_integration.id}"
}

resource "aws_apigatewayv2_stage" "bods_integrated_data_api_stage" {
  api_id = aws_apigatewayv2_api.bods_integrated_data_api.id
  name   = "bods integrated data api stage"
}

resource "aws_apigatewayv2_deployment" "bods_integrated_data_api_deployment" {
  api_id      = aws_apigatewayv2_api.bods_integrated_data_api.id
  description = "bods integrated data api deployment"

  lifecycle {
    create_before_destroy = true
  }
}


