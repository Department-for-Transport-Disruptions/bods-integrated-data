output "gtfs_timetables_bucket_name" {
  value = aws_s3_bucket.integrated_data_gtfs_timetables_bucket.id
}

output "bods_txc_zipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_bods_txc_zipped_bucket.id
}

output "tnds_txc_zipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_tnds_txc_zipped_bucket.id
}

output "txc_bucket_name" {
  value = aws_s3_bucket.integrated_data_txc_bucket.id
}

output "bods_txc_retriever_function_arn" {
  value = module.integrated_data_bods_txc_retriever_function.function_arn
}

output "tnds_txc_retriever_function_arn" {
  value = module.integrated_data_tnds_txc_retriever_function.function_arn
}

output "unzipper_function_arn" {
  value = module.integrated_data_unzipper_function.function_arn
}

output "txc_processor_function_arn" {
  value = module.integrated_data_txc_processor_function.function_arn
}

output "gtfs_timetables_generator_function_arn" {
  value = module.integrated_data_gtfs_timetables_generator_function.function_arn
}
