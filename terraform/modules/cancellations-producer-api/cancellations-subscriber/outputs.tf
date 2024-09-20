output "lambda_name" {
  description = "Lambda Name"
  value       = module.cancellations_subscriber.function_name
}

output "invoke_arn" {
  value = module.cancellations_subscriber.invoke_arn
}
