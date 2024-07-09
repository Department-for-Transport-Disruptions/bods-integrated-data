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

variable "table_name" {
  type        = string
  description = "Name of the dynamoDB table containing the subscriptions data"
}

variable "avl_producer_api_key_arn" {
  type        = string
  description = "AVL producer API key ARN"
}
