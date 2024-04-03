terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_avl_data_endpoint" {
  source = "../modules/avl-producer-api/avl-data-endpoint"

  environment = local.env
  bucket_name = "integrated-data-siri-vm-local"
}

resource "aws_lambda_function_url" "integrated_data_mock_avl_producer_function_url" {
  function_name      = module.integrated_data_avl_data_endpoint.function_name
  authorization_type = "NONE"
}

module avl_mock_data_producer {
  source = "../modules/avl-producer-api/mock-data-producer"

  environment                          = local.env
  avl_consumer_data_endpoint_url_local = aws_lambda_function_url.integrated_data_mock_avl_producer_function_url.function_url
}

module "integrated_data_avl_subscription_table" {
  source = "../modules/database/dynamo"

  environment = local.env
}

module "integrated_data_avl_subscriber" {
  source = "../modules/avl-producer-api/avl-subscriber"

  environment                      = local.env
  avl_subscription_table_name      = module.integrated_data_avl_subscription_table.table_name
  avl_local_data_producer_endpoint = module.avl_mock_data_producer.function_url
}

locals {
  env = "local"
}