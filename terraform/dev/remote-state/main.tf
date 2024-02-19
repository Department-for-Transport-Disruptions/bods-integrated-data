terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "tf-state-dev" {
  source = "../../modules/tf-state"

  environment = "dev"
}

import {
  to = module.tf-state-dev.aws_s3_bucket.terraform_state
  id = local.bucket_name
}

import {
  to = module.tf-state-dev.aws_s3_bucket_versioning.terraform_state
  id = local.bucket_name
}

import {
  to = module.tf-state-dev.aws_s3_bucket_public_access_block.public_access
  id = local.bucket_name
}

import {
  to = module.tf-state-dev.aws_dynamodb_table.terraform_state_lock
  id = local.dynamodb_table_name
}

locals {
  bucket_name         = "integrated-data-tfstate-dev"
  dynamodb_table_name = "integrated-data-state-lock-dev"
}
