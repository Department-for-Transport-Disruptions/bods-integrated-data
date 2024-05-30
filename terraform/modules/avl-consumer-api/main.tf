terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_avl_siri_vm_downloader" {
  source = "../../modules/avl-siri-vm-downloader"

  environment = var.environment
  bucket_name = var.aggregated_siri_vm_bucket_name
}

resource "aws_apigatewayv2_api" "integrated_data_avl_consumer_api" {
  name          = "integrated-data-avl-consumer-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "integrated_data_avl_consumer_downloader_integration" {
  api_id                 = aws_apigatewayv2_api.integrated_data_avl_consumer_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.integrated_data_avl_siri_vm_downloader.avl_siri_vm_downloader_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "integrated_data_avl_consumer_api_route" {
  api_id    = aws_apigatewayv2_api.integrated_data_avl_consumer_api.id
  route_key = "GET /siri-vm"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_avl_consumer_downloader_integration.id}"
}


resource "aws_apigatewayv2_deployment" "integrated_data_avl_consumer_api_deployment" {
  api_id      = aws_apigatewayv2_api.integrated_data_avl_consumer_api.id
  description = aws_apigatewayv2_api.integrated_data_avl_consumer_api.name

  triggers = {
    redeployment = sha1(join(",", tolist([
      jsonencode(aws_apigatewayv2_route.integrated_data_avl_consumer_api_route),
      jsonencode(aws_apigatewayv2_integration.integrated_data_avl_consumer_downloader_integration),
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

resource "aws_lambda_permission" "integrated_data_avl_consumer_downloader_api_permissions" {
  function_name = module.integrated_data_avl_siri_vm_downloader.avl_siri_vm_downloader_lambda_name
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.integrated_data_avl_consumer_api.execution_arn}/${aws_apigatewayv2_stage.integrated_data_avl_consumer_api_stage.name}/*"
}


resource "aws_apigatewayv2_domain_name" "integrated_data_avl_consumer_api_domain" {
  domain_name = "consumer.${var.domain}"

  domain_name_configuration {
    certificate_arn = var.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_route53_record" "integrated_data_avl_consumer_api_dns_record" {
  name    = aws_apigatewayv2_domain_name.integrated_data_avl_consumer_api_domain.domain_name
  type    = "A"
  zone_id = var.hosted_zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.integrated_data_avl_consumer_api_domain.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.integrated_data_avl_consumer_api_domain.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_apigatewayv2_api_mapping" "integrated_data_avl_consumer_api_domain_mapping" {
  api_id      = aws_apigatewayv2_api.integrated_data_avl_consumer_api.id
  domain_name = aws_apigatewayv2_domain_name.integrated_data_avl_consumer_api_domain.id
  stage       = aws_apigatewayv2_stage.integrated_data_avl_consumer_api_stage.id
}
