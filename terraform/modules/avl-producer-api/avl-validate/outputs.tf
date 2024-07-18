output "lambda_name" {
  description = "Lambda Name"
  value       = module.avl_validate.function_name
}

output "invoke_arn" {
  value = module.avl_validate.invoke_arn
}
