output "cancellations_raw_siri_bucket_name" {
  value = module.integrated_data_cancellations_s3_sqs.bucket_id
}

output "siri_sx_downloader_invoke_arn" {
  value = module.siri_sx_downloader.invoke_arn
}

output "siri_sx_downloader_function_name" {
  value = module.siri_sx_downloader.function_name
}
