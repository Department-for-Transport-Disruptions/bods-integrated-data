variable "environment" {
  type        = string
  description = "Environment"
}

variable "function_arn" {
  type        = string
  description = "Lambda Function ARN"
}

variable "invoke_every_seconds" {
  type        = number
  description = "The frequency the lambda should be invoked (e.g. invoke_every_seconds = 30 will invoke the lambda every 30 seconds)"
}

variable "step_function_name" {
  type        = string
  description = "Name of Step Function"
}

variable "disable_trigger" {
  type    = bool
  default = false
}
