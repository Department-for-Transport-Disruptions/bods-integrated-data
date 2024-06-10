variable "environment" {
  type        = string
  description = "Environment"
}

variable "bucket_name" {
  type        = string
  description = "The name of the bucket to put unprocessed SIRI-VM files into."
}

variable "avl_subscription_table_name" {
  type        = string
  description = "The name of AVL subscription DynamoDB table"
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
