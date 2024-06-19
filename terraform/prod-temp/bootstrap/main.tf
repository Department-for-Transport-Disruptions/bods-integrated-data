terraform {
  required_version = ">= 1.6.6"

  backend "s3" {
    bucket = "integrated-data-tfstate-prod-temp"

    key    = "terraform-bootstrap.tfstate"
    region = "eu-west-2"

    dynamodb_table = "integrated-data-state-lock-prod-temp"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

module "sops" {
  source = "../../modules/bootstrap/sops"

  environment = local.env
}

locals {
  env = "prod-temp"
}
