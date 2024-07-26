variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "lb_subnet_ids" {
  type        = list(string)
  description = "List of Subnet IDs to deploy load balancers into"
}

variable "siri_vm_downloader_function_name" {
  type = string
}

variable "external_ip_range" {
  type      = string
  sensitive = true
}

variable "external_account_id" {
  type      = string
  sensitive = true
}
