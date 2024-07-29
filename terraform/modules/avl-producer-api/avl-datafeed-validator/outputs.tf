output "lambda_name" {
  description = "Lambda Name"
  value       = module.avl_datafeed_validator.function_name
}

output "invoke_arn" {
  value = module.avl_datafeed_validator.invoke_arn
}
