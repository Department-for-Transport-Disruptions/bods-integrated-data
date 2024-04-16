output "lambda_name" {
  description = "Lambda Name"
  value       = module.avl_unsubscriber.function_name
}

output "invoke_arn" {
  value = module.avl_unsubscriber.invoke_arn
}
