output "acm_certificate_arn" {
  value = aws_acm_certificate.integrated_data_acm_certificate.arn
}

output "cloudfront_acm_certificate_arn" {
  value = aws_acm_certificate.integrated_data_cloudfront_acm_certificate.arn
}
