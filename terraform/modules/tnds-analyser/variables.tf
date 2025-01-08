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

variable "tnds_txc_bucket_name" {
  type = string
}

variable "naptan_bucket_name" {
  type = string
}
