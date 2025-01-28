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

variable "sg_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "cancellations_producer_api_key_arn" {
  type        = string
  description = "cancellations producer API key ARN"
}

variable "cancellations_subscription_table_name" {
  type        = string
  description = "Cancellations Subscription DynamoDB table name"
}

variable "mock_data_producer_subscribe_endpoint" {
  type        = string
  nullable    = true
  default     = null
  description = "URL for the mock data producer subscribe endpoint"
}

variable "cancellations_data_endpoint" {
  type        = string
  description = "HTTP API endpoint URL for the Cancellations Producer /data endpoint"
}

variable "internal_data_endpoint" {
  type     = string
  nullable = true
  default  = null
}
