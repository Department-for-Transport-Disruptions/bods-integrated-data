output "avl_data_endpoint_function_name" {
  value = module.avl_data_endpoint.function_name
}

output "data_endpoint_function_url" {
  value = var.environment == "local" ? aws_lambda_function_url.avl_data_endpoint_function_url[0].function_url : null
}

output "endpoint" {
  value = (var.environment == "local" ? null : module.avl_producer_api_gateway[0].endpoint)
}
