output "lambda_name" {
  description = "Lambda Name"
  value       = module.integrated_data_bods_avl_data_endpoint_function.function_name
}

output "invoke_arn" {
  value = module.integrated_data_bods_avl_data_endpoint_function.invoke_arn
}
