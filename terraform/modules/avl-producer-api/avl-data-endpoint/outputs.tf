output "lambda_name" {
  description = "Lambda Name"
  value       = module.integrated_data_bods_avl_data_endpoint_function.function_name
}

output "invoke_arn" {
  value = module.integrated_data_bods_avl_data_endpoint_function.invoke_arn
}


output "lambda_arn" {
  description = "Lambda ARN"
  value       = module.integrated_data_bods_avl_data_endpoint_function.lambda_arn
}

output "function_name" {
  description = "Lambda function name"
  value       = module.integrated_data_bods_avl_data_endpoint_function.function_name
}
