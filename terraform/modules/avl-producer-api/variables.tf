variable "environment" {
  type        = string
  description = "Environment"
}

variable "avl_subscription_table_name" {
  type        = string
  description = "AVL Subscription DynamoDB table name"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account id"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "avl_raw_siri_bucket_name" {
  type        = string
  description = "Bucket Name for SIRI-VM data"
}

variable "sg_id" {
  type        = string
  description = "Security group ID"
}

variable "avl_producer_api_key" {
  type        = string
  description = "AVL producer API key"
}

variable "subnet_ids" {
  type = list(string)
}

variable "domain" {
  type = string
}

variable "acm_certificate_arn" {
  type = string
}

variable "hosted_zone_id" {
  type = string
}

variable "avl_cloudwatch_namespace" {
  type = string
}

variable "avl_error_table_name" {
  type = string
}

variable "internal_data_endpoint" {
  type     = string
  nullable = true
  default  = null
}
