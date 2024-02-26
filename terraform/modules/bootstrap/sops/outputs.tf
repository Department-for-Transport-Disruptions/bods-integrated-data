output "kms_key_arn" {
  value = aws_kms_alias.integrated_data_sops_kms_key_alias.arn
}