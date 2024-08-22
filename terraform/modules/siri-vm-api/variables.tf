variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "api_name" {
  type = string
}

variable "private" {
  type        = bool
  description = "Whether to make the API private or not"
}

variable "siri_vm_downloader_invoke_arn" {
  type = string
}


variable "siri_vm_downloader_function_name" {
  type = string
}

variable "siri_vm_stats_invoke_arn" {
  type = string
}

variable "siri_vm_stats_function_name" {
  type = string
}

variable "external_vpces_for_sirivm_downloader" {
  type    = list(string)
  default = []
}
