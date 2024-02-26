variable "environment" {
  type        = string
  description = "Environment"
}

variable "region" {
  type        = string
  description = "Region"
  default     = "eu-west-2"
}

variable "account_id" {
  type        = string
  description = "Account ID"
}