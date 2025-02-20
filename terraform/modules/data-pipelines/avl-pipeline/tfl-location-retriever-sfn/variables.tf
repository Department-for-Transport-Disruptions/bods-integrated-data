variable "environment" {
  type        = string
  description = "Environment"
}

variable "tfl_line_id_retriever_function_arn" {
  type = string
}

variable "tfl_location_retriever_function_arn" {
  type = string
}

variable "invoke_every_seconds" {
  type        = number
  description = "The frequency the lambda should be invoked (e.g. invoke_every_seconds = 30 will invoke the lambda every 30 seconds)"
}

variable "step_function_name" {
  type        = string
  description = "Name of Step Function"
}

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}
