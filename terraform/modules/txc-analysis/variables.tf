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

variable "bods_txc_bucket_name" {
  type = string
}

variable "tnds_txc_bucket_name" {
  type = string
}

variable "naptan_bucket_name" {
  type = string
}

variable "nptg_bucket_name" {
  type = string
}

variable "schedule" {
  type        = string
  description = "Cron schedule to trigger the step function"
  nullable    = true
  default     = null
}

variable "dqs_bucket_name" {
  type        = string
  description = "Name of the DQS bucket to store TXC reports"
  nullable    = true
  default     = null
}

