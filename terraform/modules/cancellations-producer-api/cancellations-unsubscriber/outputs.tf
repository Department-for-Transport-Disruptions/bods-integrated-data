output "lambda_name" {
  description = "Lambda Name"
  value       = module.cancellations_unsubscriber.function_name
}

output "invoke_arn" {
  value = module.cancellations_unsubscriber.invoke_arn
}
