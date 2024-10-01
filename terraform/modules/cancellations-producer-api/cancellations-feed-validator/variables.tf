variable "environment" {
  type        = string
  description = "Environment"
}

variable "cancellations_subscription_table_name" {
  type        = string
  description = "Cancellations Subscription DynamoDB table name"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account id"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "cancellations_consumer_subscribe_endpoint" {
  type        = string
  description = "URL for the cancellations consumer subscribe endpoint."
}

variable "cancellations_producer_api_key_arn" {
  type        = string
  description = "Cancellations producer API key ARN"
}

variable "sg_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}
