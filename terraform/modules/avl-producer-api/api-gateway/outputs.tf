output "endpoint" {
  description = "HTTP API endpoint URL"
  value       = aws_apigatewayv2_domain_name.integrated_data_avl_producer_api_domain.domain_name
}
