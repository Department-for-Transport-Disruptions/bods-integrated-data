output "bank_holidays_retriever_function_arn" {
  value = module.integrated_data_bank_holidays_retriever_function.function_arn
}

output "bank_holidays_bucket_name" {
  value = aws_s3_bucket.integrated_data_bank_holidays_bucket.bucket
}

output "bank_holidays_bucket_arn" {
  value = aws_s3_bucket.integrated_data_bank_holidays_bucket.arn
}
