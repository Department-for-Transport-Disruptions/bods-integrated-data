variable "environment" {
  type        = string
  description = "Environment"
}

variable avl_subscription_table_name {
  type        = string
  description = "AVL Subscription DynamoDB table name"
}

variable aws_account_id {
  type        = string
  description = "AWS account id"
}

variable aws_region {
  type        = string
  description = "AWS region"
}

variable "avl_consumer_subscribe_endpoint" {
  type        = string
  description = "URL for the AVL consumer subscribe endpoint."
}