terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_apigatewayv2_api" "integrated_data_gtfs_api" {
  name          = "integrated-data-gtfs-api-${var.environment}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "integrated_data_gtfs_downloader_integration" {
  api_id                 = aws_apigatewayv2_api.integrated_data_gtfs_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.gtfs_downloader_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "integrated_data_gtfs_api_route" {
  api_id    = aws_apigatewayv2_api.integrated_data_gtfs_api.id
  route_key = "GET /gtfs"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_gtfs_downloader_integration.id}"
}

resource "aws_apigatewayv2_integration" "integrated_data_gtfs_rt_downloader_integration" {
  api_id                 = aws_apigatewayv2_api.integrated_data_gtfs_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.gtfs_rt_downloader_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "integrated_data_gtfs_rt_api_route" {
  api_id    = aws_apigatewayv2_api.integrated_data_gtfs_api.id
  route_key = "GET /gtfs-rt"
  target    = "integrations/${aws_apigatewayv2_integration.integrated_data_gtfs_rt_downloader_integration.id}"
}

resource "aws_apigatewayv2_deployment" "integrated_data_gtfs_api_deployment" {
  api_id      = aws_apigatewayv2_api.integrated_data_gtfs_api.id
  description = aws_apigatewayv2_api.integrated_data_gtfs_api.name

  triggers = {
    redeployment = sha1(join(",", tolist([
      jsonencode(aws_apigatewayv2_route.integrated_data_gtfs_api_route),
      jsonencode(aws_apigatewayv2_integration.integrated_data_gtfs_downloader_integration),
      jsonencode(aws_apigatewayv2_route.integrated_data_gtfs_rt_api_route),
      jsonencode(aws_apigatewayv2_integration.integrated_data_gtfs_rt_downloader_integration),
    ])))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_stage" "integrated_data_gtfs_api_stage" {
  api_id      = aws_apigatewayv2_api.integrated_data_gtfs_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "integrated_data_gtfs_downloader_api_permissions" {
  function_name = var.gtfs_downloader_lambda_name
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.integrated_data_gtfs_api.execution_arn}/${aws_apigatewayv2_stage.integrated_data_gtfs_api_stage.name}/*"
}

resource "aws_lambda_permission" "integrated_data_gtfs_rt_downloader_api_permissions" {
  function_name = var.gtfs_rt_downloader_lambda_name
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.integrated_data_gtfs_api.execution_arn}/${aws_apigatewayv2_stage.integrated_data_gtfs_api_stage.name}/*"
}

resource "aws_apigatewayv2_domain_name" "integrated_data_gtfs_api_domain" {
  domain_name = "gtfs.${var.domain}"

  domain_name_configuration {
    certificate_arn = var.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_route53_record" "integrated_data_gtfs_api_dns_record" {
  name    = aws_apigatewayv2_domain_name.integrated_data_gtfs_api_domain.domain_name
  type    = "A"
  zone_id = var.hosted_zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.integrated_data_gtfs_api_domain.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.integrated_data_gtfs_api_domain.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_apigatewayv2_api_mapping" "integrated_data_gtfs_api_domain_mapping" {
  api_id      = aws_apigatewayv2_api.integrated_data_gtfs_api.id
  domain_name = aws_apigatewayv2_domain_name.integrated_data_gtfs_api_domain.id
  stage       = aws_apigatewayv2_stage.integrated_data_gtfs_api_stage.id
}