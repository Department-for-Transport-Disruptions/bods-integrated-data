output "disruptions_retriever_function_arn" {
  value = module.integrated_data_bods_disruptions_retriever_function.function_arn
}

output "disruptions_zipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_bods_disruptions_zipped_bucket.id
}
