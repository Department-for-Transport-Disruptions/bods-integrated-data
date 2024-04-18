terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

module "integrated_data_avl_data_endpoint" {
  source = "../modules/avl-producer-api/avl-data-endpoint"

  environment                 = local.env
  bucket_name                 = "integrated-data-siri-vm-local"
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
}

resource "aws_lambda_function_url" "integrated_data_mock_avl_producer_function_url" {
  function_name      = module.integrated_data_avl_data_endpoint.function_name
  authorization_type = "NONE"
}

module "integrated_data_avl_subscription_table" {
  source = "../modules/database/dynamo"

  environment = local.env
}

module "avl_mock_data_producer" {
  source = "../modules/avl-producer-api/mock-data-producer"

  environment                 = local.env
  avl_consumer_data_endpoint  = aws_lambda_function_url.integrated_data_mock_avl_producer_function_url.function_url
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
}

module "integrated_data_avl_subscriber" {
  source = "../modules/avl-producer-api/avl-subscriber"

  environment                               = local.env
  avl_subscription_table_name               = module.integrated_data_avl_subscription_table.table_name
  avl_mock_data_producer_subscribe_endpoint = module.avl_mock_data_producer.function_url
  avl_data_endpoint                         = "https://www.mock-data-endpoint.com/data"
  aws_account_id                            = data.aws_caller_identity.current.account_id
  aws_region                                = data.aws_region.current.name
}

module "avl-unsubscriber" {
  source = "../modules/avl-producer-api/avl-unsubscriber"

  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
  environment                 = local.env
}

module "integrated_data_bank_holidays_pipeline" {
  source = "../modules/data-pipelines/bank-holidays-pipeline"

  environment = local.env
}

locals {
  env = "local"
}
