output "endpoint" {
  value = (var.environment == "local" ? null : module.cancellations_producer_api_gateway[0].endpoint)
}

output "subscriptions_table_name" {
  value = module.integrated_data_cancellations_subscription_table.table_name
}

output "errors_table_name" {
  value = module.integrated_data_cancellations_validation_error_table.table_name
}

output "data_endpoint_function_url" {
  value = var.environment == "local" ? aws_lambda_function_url.cancellations_data_endpoint_function_url[0].function_url : null
}

output "data_endpoint_function_name" {
  value = module.cancellations_data_endpoint.function_name
}
