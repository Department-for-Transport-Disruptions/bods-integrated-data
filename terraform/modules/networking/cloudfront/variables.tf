variable "environment" {
  type        = string
  description = "Environment"
}

variable "avl_siri_vm_downloader_domain" {
  type        = string
  description = "AVL siri-vm downloader domain"
}

variable "avl_siri_vm_downloader_function_name" {
  type        = string
  description = "AVL siri-vm downloader function name"
}

variable "avl_siri_vm_data_producer_domain" {
  type        = string
  description = "AVL siri-vm data producer domain"
}

variable "avl_siri_vm_data_producer_allowed_ips" {
  type        = list(string)
  description = "AVL siri-vm data producer allowed IPs"
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
