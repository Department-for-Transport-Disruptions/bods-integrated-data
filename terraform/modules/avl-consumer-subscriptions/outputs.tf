output "avl_consumer_subscriber_lambda_invoke_arn" {
  value = module.avl_consumer_subscriber.invoke_arn
}

output "avl_consumer_subscriber_function_name" {
  value = module.avl_consumer_subscriber.function_name
}

output "avl_consumer_unsubscriber_lambda_invoke_arn" {
  value = module.avl_consumer_unsubscriber.invoke_arn
}

output "avl_consumer_unsubscriber_function_name" {
  value = module.avl_consumer_unsubscriber.function_name
}

output "avl_mock_data_receiver_lambda_invoke_arn" {
  value = module.avl_mock_data_receiver.invoke_arn
}

output "avl_mock_data_receiver_function_name" {
  value = module.avl_mock_data_receiver.function_name
}
