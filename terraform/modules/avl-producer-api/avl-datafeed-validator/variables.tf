variable "environment" {
  type        = string
  description = "Environment"
}

variable "avl_error_table_name" {
  type        = string
  description = "AVL Error DynamoDB table name"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account id"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "avl_producer_api_key_arn" {
  type        = string
  description = "AVL producer API key ARN"
}

variable "avl_subscription_table_name" {
  type        = string
  description = "AVL Subscriptions DynamoDB table name"
}
