output "endpoint" {
  value = (var.environment == "local" ? null : module.cancellations_producer_api_gateway[0].endpoint)
}

output "table_name" {
  value = module.integrated_data_cancellations_subscription_table.table_name
}

output "data_endpoint_function_url" {
  value = aws_lambda_function_url.cancellations_data_endpoint_function_url.function_url
}
