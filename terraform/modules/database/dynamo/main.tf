terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_dynamodb_table" "integrated_data_avl_subscription_table" {
  name                        = "integrated-data-avl-subscription-table-${var.environment}"
  billing_mode                = "PAY_PER_REQUEST"
  deletion_protection_enabled = var.environment == "prod" ? true : false
  hash_key                    = "PK"
  range_key                   = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }
}

output "table_name" {
  description = "AVL Subscriptions Dynamo Table name"
  value       = aws_dynamodb_table.integrated_data_avl_subscription_table.name
}
