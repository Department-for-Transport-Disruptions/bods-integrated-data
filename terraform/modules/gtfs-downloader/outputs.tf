output "gtfs_downloader_lambda_name" {
  value = module.integrated_data_gtfs_downloader_function.function_name
}

output "gtfs_downloader_invoke_arn" {
  value = module.integrated_data_gtfs_downloader_function.invoke_arn
}
