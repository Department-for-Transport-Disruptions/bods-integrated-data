terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

module "integrated_data_avl_siri_vm_downloader" {
  source = "../../modules/avl-siri-vm-downloader"

  environment          = var.environment
  bucket_name          = var.generated_siri_vm_bucket_name
  vpc_id               = var.vpc_id
  private_subnet_ids   = var.private_subnet_ids
  db_secret_arn        = var.db_secret_arn
  db_sg_id             = var.db_sg_id
  db_host              = var.db_host
  avl_consumer_api_key = var.avl_consumer_api_key
}

resource "aws_apigatewayv2_api" "integrated_data_avl_consumer_api" {
  name          = "integrated-data-avl-consumer-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_deployment" "integrated_data_avl_consumer_api_deployment" {
  api_id      = aws_apigatewayv2_api.integrated_data_avl_consumer_api.id
  description = aws_apigatewayv2_api.integrated_data_avl_consumer_api.name

  triggers = {
    redeployment = sha1(join(",", tolist([
    ])))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_stage" "integrated_data_avl_consumer_api_stage" {
  api_id      = aws_apigatewayv2_api.integrated_data_avl_consumer_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 15000
  }
}

resource "aws_apigatewayv2_domain_name" "integrated_data_avl_consumer_api_domain" {
  domain_name = "avl.${var.domain}"

  domain_name_configuration {
    certificate_arn = var.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "integrated_data_avl_consumer_api_domain_mapping" {
  api_id      = aws_apigatewayv2_api.integrated_data_avl_consumer_api.id
  domain_name = aws_apigatewayv2_domain_name.integrated_data_avl_consumer_api_domain.id
  stage       = aws_apigatewayv2_stage.integrated_data_avl_consumer_api_stage.id
}
