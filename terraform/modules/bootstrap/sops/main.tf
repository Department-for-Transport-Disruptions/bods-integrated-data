terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_kms_key" "integrated_data_sops_kms_key" {
  description = "KMS key to use with SOPS"
}

resource "aws_kms_alias" "integrated_data_sops_kms_key_alias" {
  target_key_id = aws_kms_key.integrated_data_sops_kms_key.id
  name          = "alias/integrated-data-sops-kms-${var.environment}"
}
