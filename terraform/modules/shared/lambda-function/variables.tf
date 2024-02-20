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
