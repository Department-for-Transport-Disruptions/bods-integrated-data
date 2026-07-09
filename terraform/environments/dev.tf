# Data team database access provisioning
# Environment: Integrated Data Dev, Test, UAT
# Purpose: Grant DDL+DML access to analysts

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}

locals {
  data_team_members = [
    "aniruddha_joglekar",
    "andrew_egleton"
  ]

  # Integrated Data databases (3 environments)
  databases_to_provision = [
    {
      project     = "integrated-data"
      environment = "dev"
      database    = "integrated_data"
      rds_arn     = data.aws_db_instance.integrated_data_dev.db_instance_arn
      endpoint    = data.aws_db_instance.integrated_data_dev.address
    },
    {
      project     = "integrated-data"
      environment = "test"
      database    = "integrated_data"
      rds_arn     = data.aws_db_instance.integrated_data_test.db_instance_arn
      endpoint    = data.aws_db_instance.integrated_data_test.address
    },
    {
      project     = "integrated-data"
      environment = "uat"
      database    = "integrated_data"
      rds_arn     = data.aws_db_instance.integrated_data_uat.db_instance_arn
      endpoint    = data.aws_db_instance.integrated_data_uat.address
    },
  ]

  secrets_kms_key_ids = {
    dev  = data.aws_kms_key.dev.id
    test = data.aws_kms_key.test.id
    uat  = data.aws_kms_key.uat.id
  }
}

# Data sources for Integrated Data RDS instances
data "aws_db_instance" "integrated_data_dev" {
  db_instance_identifier = "integrated-data-dev"
}

data "aws_db_instance" "integrated_data_test" {
  db_instance_identifier = "integrated-data-test"
}

data "aws_db_instance" "integrated_data_uat" {
  db_instance_identifier = "integrated-data-uat"
}

# Reference KMS keys for each environment
data "aws_kms_key" "dev" {
  key_id = "0320e43f-483b-4cf3-89c4-c2c0319b17ea"
}

data "aws_kms_key" "test" {
  key_id = "0320e43f-483b-4cf3-89c4-c2c0319b17ea"
}

data "aws_kms_key" "uat" {
  key_id = "0320e43f-483b-4cf3-89c4-c2c0319b17ea"
}

# Provision analyst database access (reuse BODDS module)
module "database_analyst_access" {
  source = "git::https://github.com/department-for-transport-BODS/BODDS-INFRASTRUCTURE.git//terraform/modules/database_analyst_access?ref=main"

  data_team_members      = local.data_team_members
  databases_to_provision = local.databases_to_provision
  secrets_kms_key_ids    = local.secrets_kms_key_ids
}

output "analyst_credentials_summary" {
  description = "Summary of provisioned credentials"
  value = {
    analysts_count    = length(local.data_team_members)
    databases_count   = length(local.databases_to_provision)
    total_credentials = length(local.data_team_members) * length(local.databases_to_provision)
    credential_arns   = module.database_analyst_access.credential_secrets
  }
}

output "pglifecycle_event_json" {
  description = "pglifecycle Lambda event for user provisioning"
  value       = module.database_analyst_access.pglifecycle_event_json
}
