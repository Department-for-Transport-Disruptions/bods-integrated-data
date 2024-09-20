terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_secretsmanager_secret" "cancellations_producer_api_key_secret" {
  name = "cancellations_producer_api_key"
}

resource "aws_secretsmanager_secret_version" "cancellations_producer_api_key_secret_version" {
  secret_id     = aws_secretsmanager_secret.cancellations_producer_api_key_secret.id
  secret_string = jsonencode(var.cancellations_producer_api_key)
}

module "cancellations_producer_api_gateway" {
  count               = var.environment == "local" ? 0 : 1
  source              = "./api-gateway"
  environment         = var.environment
  domain              = var.domain
  acm_certificate_arn = var.acm_certificate_arn
  hosted_zone_id      = var.hosted_zone_id
}
