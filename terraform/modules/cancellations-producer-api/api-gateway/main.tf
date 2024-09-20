terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_apigatewayv2_api" "integrated_data_cancellations_producer_api" {
  name          = "integrated-data-cancellations-producer-api-${var.environment}"
  protocol_type = "HTTP"
}


resource "aws_apigatewayv2_deployment" "integrated_data_cancellations_producer_api_deployment" {
  api_id      = aws_apigatewayv2_api.integrated_data_cancellations_producer_api.id
  description = aws_apigatewayv2_api.integrated_data_cancellations_producer_api.name

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_stage" "integrated_data_cancellations_producer_api_stage" {
  api_id      = aws_apigatewayv2_api.integrated_data_cancellations_producer_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 15000
  }
}

resource "aws_apigatewayv2_domain_name" "integrated_data_cancellations_producer_api_domain" {
  domain_name = "cancellations-producer.${var.domain}"

  domain_name_configuration {
    certificate_arn = var.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_route53_record" "integrated_data_cancellations_producer_api_dns_record" {
  name    = aws_apigatewayv2_domain_name.integrated_data_cancellations_producer_api_domain.domain_name
  type    = "A"
  zone_id = var.hosted_zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.integrated_data_cancellations_producer_api_domain.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.integrated_data_cancellations_producer_api_domain.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_apigatewayv2_api_mapping" "integrated_data_cancellations_producer_api_domain_mapping" {
  api_id      = aws_apigatewayv2_api.integrated_data_cancellations_producer_api.id
  domain_name = aws_apigatewayv2_domain_name.integrated_data_cancellations_producer_api_domain.id
  stage       = aws_apigatewayv2_stage.integrated_data_cancellations_producer_api_stage.id
}
