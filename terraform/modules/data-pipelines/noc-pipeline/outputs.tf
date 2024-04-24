output "noc_retriever_function_arn" {
  value = module.integrated_data_noc_retriever_function.function_arn
}

output "noc_processor_function_arn" {
  value = module.integrated_data_noc_processor_function.function_arn
}

output "noc_bucket_name" {
  value = aws_s3_bucket.integrated_data_noc_bucket.id
}
