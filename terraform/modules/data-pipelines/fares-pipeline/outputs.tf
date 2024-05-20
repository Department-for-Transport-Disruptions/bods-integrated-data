output "fares_retriever_function_arn" {
  value = module.integrated_data_bods_fares_retriever_function.function_arn
}

output "fares_processor_function_arn" {
  value = module.integrated_data_bods_fares_retriever_function.function_arn
}

output "fares_zipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_bods_fares_zipped_bucket.id
}
