output "subscribe_function_url" {
  description = "Function URL for subscribe lambda for local deployment"
  value       = (var.environment == "local" ?
    aws_lambda_function_url.integrated_data_mock_producer_subscribe_function_url[0].function_url : null)
}

output "endpoint" {
  description = "HTTP API endpoint URL"
  value       = (var.environment == "local" ? null :
    aws_apigatewayv2_api.integrated_data_mock_producer_api[0].api_endpoint)
}
