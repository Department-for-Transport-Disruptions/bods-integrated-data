terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

module "integrated_data_avl_consumer_subscription_table" {
  source = "../shared/dynamo-table"

  environment = var.environment
  table_name  = "integrated-data-avl-consumer-subscription-table"
}
