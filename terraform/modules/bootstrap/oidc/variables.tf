variable "environment" {
  type        = string
  description = "Environment"
}

variable "sops_kms_key_arn" {
  type        = string
  description = "ARN of the KMS key used with SOPS"
}
