terraform {
  required_version = ">= 1.6.6"

  backend "s3" {
    bucket = "integrated-data-tfstate-prod"
    key    = "terraform.tfstate"
    region = "eu-west-2"

    dynamodb_table = "integrated-data-state-lock-prod"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }

    sops = {
      source  = "carlpett/sops"
      version = "~> 1.0"
    }
  }
}

data "aws_region" "current" {}

data "sops_file" "secrets" {
  source_file = "secrets.enc.json"
}

module "external_data_archive" {
  source = "../modules/external-data-archive"

  environment = local.env
}

locals {
  env     = "prod"
  secrets = jsondecode(data.sops_file.secrets.raw)
}
