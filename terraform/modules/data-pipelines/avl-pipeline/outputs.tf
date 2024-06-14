output "avl_generated_siri_bucket_name" {
  value = aws_s3_bucket.integrated_data_avl_generated_siri_vm_bucket.id
}

output "avl_raw_siri_bucket_name" {
  value = module.integrated_data_avl_s3_sqs.bucket_id
}
