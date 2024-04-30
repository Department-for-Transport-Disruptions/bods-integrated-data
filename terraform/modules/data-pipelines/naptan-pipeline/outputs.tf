output "naptan_retriever_function_arn" {
  value = module.integrated_data_naptan_retriever_function.function_arn
}

output "naptan_uploader_function_arn" {
  value = module.integrated_data_naptan_uploader_function.function_arn
}

output "naptan_bucket_name" {
  value = aws_s3_bucket.integrated_data_naptan_s3_bucket.id
}
