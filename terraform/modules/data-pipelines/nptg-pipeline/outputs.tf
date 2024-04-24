output "nptg_retriever_function_arn" {
  value = module.integrated_data_nptg_retriever_function.function_arn
}

output "nptg_uploader_function_arn" {
  value = module.integrated_data_nptg_uploader_function.function_arn
}

output "nptg_bucket_name" {
  value = aws_s3_bucket.integrated_data_nptg_s3_bucket.id
}
