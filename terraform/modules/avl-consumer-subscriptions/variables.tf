variable "environment" {
  type        = string
  description = "Environment"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account id"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "avl_producer_subscription_table" {
  type = string
}

variable "avl_consumer_subscription_data_sender_function_name" {
  type = string
}

variable "avl_consumer_subscription_trigger_function_arn" {
  type = string
}
