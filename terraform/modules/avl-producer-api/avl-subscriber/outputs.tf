output "lambda_name" {
  description = "Lambda Name"
  value       = module.avl_subscriber.function_name
}

output "invoke_arn" {
  value = module.avl_subscriber.invoke_arn
}
