terraform {
  required_version = ">= 1.6.6"

  backend "s3" {
    bucket = "integrated-data-tfstate-shared-services"

    key    = "terraform-bootstrap.tfstate"
    region = "eu-west-2"

    dynamodb_table = "integrated-data-state-lock-shared-services"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "sops" {
  source = "../../modules/bootstrap/sops"

  environment = local.env
}

module "oidc" {
  source = "../../modules/bootstrap/oidc"

  environment      = local.env
  sops_kms_key_arn = module.sops.kms_key_arn
}

locals {
  env = "shared-services"
}
