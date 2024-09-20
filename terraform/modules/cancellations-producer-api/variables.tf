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

variable "cancellations_producer_api_key" {
  type        = string
  description = "Cancellations producer API key"
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

variable "sg_id" {
  type        = string
  description = "Security group ID"
}

variable "subnet_ids" {
  type = list(string)
}

