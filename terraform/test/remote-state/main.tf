terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

module "tf_state" {
  source = "../../modules/bootstrap/tf-state"

  environment = local.env
}

import {
  to = module.tf_state.aws_s3_bucket.terraform_state
  id = local.bucket_name
}

import {
  to = module.tf_state.aws_s3_bucket_versioning.terraform_state
  id = local.bucket_name
}

import {
  to = module.tf_state.aws_s3_bucket_public_access_block.public_access
  id = local.bucket_name
}

import {
  to = module.tf_state.aws_dynamodb_table.terraform_state_lock
  id = local.dynamodb_table_name
}

locals {
  bucket_name         = "integrated-data-tfstate-test"
  dynamodb_table_name = "integrated-data-state-lock-test"
  env                 = "test"
}
