variable "environment" {
  type        = string
  description = "Environment"
}

variable "avl_consumer_data_endpoint" {
  type        = string
  description = "URL for the AVL consumer data endpoint."
}

variable "avl_subscription_table_name" {
  type        = string
  description = "Table name for AVL subscriptions"
}

variable aws_account_id {
  type        = string
  description = "AWS account id"
}

variable aws_region {
  type        = string
  description = "AWS region"
}