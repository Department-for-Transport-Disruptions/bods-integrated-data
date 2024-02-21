variable "function_name" {
  type     = string
  nullable = false
}

variable "zip_path" {
  type     = string
  nullable = false
}

variable "role_arn" {
  type     = string
  nullable = false
}

variable "handler" {
  type     = string
  nullable = false
}

variable "runtime" {
  type     = string
  nullable = false
}

variable "timeout" {
  type     = number
  nullable = false
}

variable "memory" {
  type     = number
  nullable = false
}

variable "env_vars" {
  type        = map(string)
  nullable    = true
  default     = null
  description = "Map of environment variables"
}

variable "subnet_ids" {
  type        = list(string)
  nullable    = true
  default     = null
  description = "List of subnet IDs to use for a VPC lambda"
}

variable "security_group_ids" {
  type        = list(string)
  nullable    = true
  default     = null
  description = "List of Security Group IDs to use for a VPC lambda"
}

variable "schedule" {
  type        = string
  nullable    = true
  default     = null
  description = "Provide cron schedule or rate to trigger the lambda on a schedule"
}

variable "s3_bucket_trigger" {
  type        = map(string)
  nullable    = true
  default     = null
  description = "ID and ARN of the bucket which will trigger the function when new objects are uploaded"
}
