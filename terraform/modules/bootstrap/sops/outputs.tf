output "kms_key_arn" {
  value = aws_kms_key.integrated_data_sops_kms_key.arn
}