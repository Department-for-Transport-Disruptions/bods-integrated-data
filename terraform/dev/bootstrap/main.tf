terraform {
  required_version = ">= 1.6.6"

  backend "s3" {
    bucket = "integrated-data-tfstate-dev"

    key    = "terraform-bootstrap.tfstate"
    region = "eu-west-2"

    dynamodb_table = "integrated-data-state-lock-dev"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "oidc" {
  source = "../../modules/oidc"

  environment = "dev"
}
