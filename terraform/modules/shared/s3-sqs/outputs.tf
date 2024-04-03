output "sqs_arn" {
  value = aws_sqs_queue.queue.arn
}

output "bucket_arn" {
  value = aws_s3_bucket.bucket.arn
}

output "bucket_name" {
  value = aws_s3_bucket.bucket.id
}