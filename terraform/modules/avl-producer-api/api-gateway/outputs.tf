output "endpoint" {
  description = "HTTP API endpoint URL"
  value       = aws_apigatewayv2_api.integrated_data_avl_producer_api.api_endpoint
}
