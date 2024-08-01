variable "environment" {
  type        = string
  description = "Environment"
}

variable "subscribe_lambda_name" {
  type        = string
  description = "Subscribe Lambda Name"
}

variable "subscribe_lambda_invoke_arn" {
  type        = string
  description = "Subscribe Lambda Invoke ARN"
}

variable "unsubscribe_lambda_name" {
  type        = string
  description = "Unsubscribe Lambda Name"
}

variable "unsubscribe_lambda_invoke_arn" {
  type        = string
  description = "Unsubscribe Lambda Invoke ARN"
}

variable "update_lambda_name" {
  type        = string
  description = "Update subscription Lambda Name"
}

variable "update_lambda_invoke_arn" {
  type        = string
  description = "Update subscription Lambda Invoke ARN"
}

variable "data_endpoint_lambda_name" {
  type        = string
  description = "Data endpoint Lambda Name"
}

variable "data_endpoint_lambda_invoke_arn" {
  type        = string
  description = "Data endpoint Lambda Invoke ARN"
}

variable "subscriptions_lambda_name" {
  type        = string
  description = "Subscriptions Lambda Name"
}

variable "subscriptions_lambda_invoke_arn" {
  type        = string
  description = "Subscriptions Lambda Invoke ARN"
}

variable "validate_lambda_name" {
  type        = string
  description = "Validate Lambda Name"
}

variable "validate_lambda_invoke_arn" {
  type        = string
  description = "Validate Lambda Invoke ARN"
}

variable "datafeed_validator_lambda_name" {
  type        = string
  description = "Datafeed Validator Lambda Name"
}

variable "datafeed_validator_lambda_invoke_arn" {
  type        = string
  description = "Datafeed Validator Lambda Invoke ARN"
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
