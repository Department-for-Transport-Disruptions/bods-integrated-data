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

variable "data_endpoint_lambda_name" {
  type        = string
  description = "Data endpoint Lambda Name"
}

variable "data_endpoint_lambda_invoke_arn" {
  type        = string
  description = "Data endpoint Lambda Invoke ARN"
}
