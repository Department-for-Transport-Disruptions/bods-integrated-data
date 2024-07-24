output "endpoint" {
  value = module.avl_producer_api_gateway[0].endpoint
}

output "avl_data_endpoint_function_name" {
  value = module.avl_data_endpoint.function_name
}
