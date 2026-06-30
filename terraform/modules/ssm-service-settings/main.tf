terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.50"
    }
  }
}


resource "aws_ssm_service_setting" "high_throughput" {
  setting_id    = "/ssm/parameter-store/high-throughput-enabled"
  setting_value = "true"
}
