output "disruptions_retriever_function_arn" {
  value = module.integrated_data_bods_disruptions_retriever_function.function_arn
}

output "disruptions_unzipped_bucket_name" {
  value = aws_s3_bucket.integrated_data_bods_disruptions_unzipped_bucket.id
}

output "disruptions_gtfs_rt_bucket_name" {
  value = aws_s3_bucket.integrated_data_bods_disruptions_gtfs_rt_bucket.id
}

output "disruptions_gtfs_rt_bucket_arn" {
  value = aws_s3_bucket.integrated_data_bods_disruptions_gtfs_rt_bucket.arn
}
