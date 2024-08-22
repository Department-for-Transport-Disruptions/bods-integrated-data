output "avl_consumer_subscriber_lambda_arn" {
  description = "AVL consumer subscriber lambda ARN"
  value       = module.avl_consumer_subscriber.lambda_arn
}

output "avl_consumer_subscriber_function_name" {
  description = "AVL consumer subscriber lambda function name"
  value       = module.avl_consumer_subscriber.function_name
}
