output "lambda_name" {
  description = "Lambda Name"
  value       = module.avl_update_endpoint.function_name
}

output "invoke_arn" {
  value = module.avl_update_endpoint.invoke_arn
}
