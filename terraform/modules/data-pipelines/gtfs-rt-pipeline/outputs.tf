output "gtfs_rt_downloader_lambda_name" {
  value = module.integrated_data_gtfs_rt_downloader_function.function_name
}

output "gtfs_rt_downloader_invoke_arn" {
  value = module.integrated_data_gtfs_rt_downloader_function.invoke_arn
}
