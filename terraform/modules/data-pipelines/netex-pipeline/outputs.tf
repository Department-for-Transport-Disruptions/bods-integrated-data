output "bods_netex_retriever_function_arn" {
  value = module.integrated_data_bods_netex_retriever_function.function_arn
}

output "bods_netex_unzipper_function_arn" {
  value = module.integrated_data_bods_netex_unzipper_function.function_arn
}

output "bods_netex_zipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_bods_netex_zipped_bucket.id
}

output "bods_netex_bucket_name" {
  value = aws_s3_bucket.integrated_data_bods_netex_bucket.id
}
