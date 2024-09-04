terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_dynamodb_table" "table" {
  name                        = "${var.table_name}-${var.environment}"
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

  dynamic "ttl" {
    for_each = var.ttl_attribute != null ? [1] : []

    content {
      enabled        = true
      attribute_name = var.ttl_attribute
    }
  }

  dynamic "global_secondary_index" {
    for_each = var.global_secondary_index != null ? [1] : []

    content {
      name            = "${var.global_secondary_index}-index"
      hash_key        = var.global_secondary_index
      projection_type = "ALL"
    }
  }

  dynamic "attribute" {
    for_each = var.global_secondary_index != null ? [1] : []

    content {
      name = var.global_secondary_index
      type = "S"
    }
  }
}
