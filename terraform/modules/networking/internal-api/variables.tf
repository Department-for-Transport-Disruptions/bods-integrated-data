variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "nlb_subnet_ids" {
  type        = list(string)
  description = "List of Subnet IDs to deploy NLB into"
}

variable "external_ip_range" {
  type      = string
  sensitive = true
}

variable "external_account_id" {
  type      = string
  sensitive = true
}
