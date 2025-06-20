output "tfl_txc_bucket_name" {
  value = aws_s3_bucket.integrated_data_tfl_txc_bucket.bucket
}

output "tfl_txc_sfn_arn" {
  value = aws_sfn_state_machine.integrated_data_tfl_txc_sfn.arn
}

output "tfl_txc_sfn_name" {
  value = aws_sfn_state_machine.integrated_data_tfl_txc_sfn.name
}
