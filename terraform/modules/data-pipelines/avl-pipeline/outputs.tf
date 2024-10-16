output "avl_generated_siri_bucket_name" {
  value = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id
}

output "avl_generated_siri_bucket_arn" {
  value = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn
}

output "avl_raw_siri_bucket_name" {
  value = module.integrated_data_avl_s3_sqs.bucket_id
}

output "siri_vm_downloader_invoke_arn" {
  value = module.siri_vm_downloader.invoke_arn
}

output "siri_vm_downloader_function_name" {
  value = module.siri_vm_downloader.function_name
}

output "siri_vm_stats_invoke_arn" {
  value = module.siri_vm_stats.invoke_arn
}

output "siri_vm_stats_function_name" {
  value = module.siri_vm_stats.function_name
}

output "avl_consumer_subscriber_invoke_arn" {
  value = module.integrated_data_avl_data_consumer_subscriptions.avl_consumer_subscriber_lambda_invoke_arn
}

output "avl_consumer_subscriber_function_name" {
  value = module.integrated_data_avl_data_consumer_subscriptions.avl_consumer_subscriber_function_name
}

output "avl_consumer_unsubscriber_invoke_arn" {
  value = module.integrated_data_avl_data_consumer_subscriptions.avl_consumer_unsubscriber_lambda_invoke_arn
}

output "avl_consumer_unsubscriber_function_name" {
  value = module.integrated_data_avl_data_consumer_subscriptions.avl_consumer_unsubscriber_function_name
}

output "avl_consumer_subscriptions_invoke_arn" {
  value = module.integrated_data_avl_data_consumer_subscriptions.avl_consumer_subscriptions_lambda_invoke_arn
}

output "avl_consumer_subscriptions_function_name" {
  value = module.integrated_data_avl_data_consumer_subscriptions.avl_consumer_subscriptions_function_name
}
