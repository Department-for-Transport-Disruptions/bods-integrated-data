output "avl_subscriptions_lambda_name" {
  value = module.integrated_data_avl_subscriptions_function.function_name
}

output "avl_subscriptions_invoke_arn" {
  value = module.integrated_data_avl_subscriptions_function.invoke_arn
}
