output "netex_retriever_function_arn" {
  value = module.integrated_data_netex_retriever_function.function_arn
}

output "netex_unzipper_function_arn" {
  value = module.integrated_data_netex_unzipper_function.function_arn
}

output "netex_zipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_netex_zipped_bucket.id
}

output "netex_bucket_name" {
  value = aws_s3_bucket.integrated_data_netex_bucket.id
}
