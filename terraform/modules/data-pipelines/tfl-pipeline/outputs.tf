output "tfl_timetable_retriever_function_arn" {
  value = module.integrated_data_tfl_timetable_retriever_function.function_arn
}

output "tfl_timetable_unzipper_function_arn" {
  value = module.integrated_data_tfl_timetable_unzipper_function.function_arn
}

output "tfl_timetable_processor_function_arn" {
  value = module.integrated_data_tfl_timetable_processor_function.function_arn
}

output "tfl_timetable_zipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_tfl_timetable_zipped_bucket.id
}

output "tfl_timetable_bucket_name" {
  value = aws_s3_bucket.integrated_data_tfl_timetable_bucket.id
}
