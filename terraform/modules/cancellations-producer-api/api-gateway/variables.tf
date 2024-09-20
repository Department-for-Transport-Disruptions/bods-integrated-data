variable "environment" {
  type        = string
  description = "Environment"
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

variable "subscribe_lambda_name" {
  type        = string
  description = "Subscribe Lambda Name"
}

variable "subscribe_lambda_invoke_arn" {
  type        = string
  description = "Subscribe Lambda Invoke ARN"
}
