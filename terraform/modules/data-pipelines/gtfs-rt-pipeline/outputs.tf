output "gtfs_rt_downloader_lambda_name" {
  value = module.integrated_data_gtfs_rt_downloader_function.function_name
}

output "gtfs_rt_downloader_invoke_arn" {
  value = module.integrated_data_gtfs_rt_downloader_function.invoke_arn
}

output "gtfs_rt_service_alerts_downloader_lambda_name" {
  value = module.integrated_data_gtfs_rt_service_alerts_downloader_function.function_name
}

output "gtfs_rt_service_alerts_downloader_invoke_arn" {
  value = module.integrated_data_gtfs_rt_service_alerts_downloader_function.invoke_arn
}

output "gtfs_rt_bucket_name" {
  value = aws_s3_bucket.integrated_data_gtfs_rt_bucket.bucket
}

output "gtfs_rt_bucket_arn" {
  value = aws_s3_bucket.integrated_data_gtfs_rt_bucket.arn
}
