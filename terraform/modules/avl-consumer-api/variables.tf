variable "environment" {
  type        = string
  description = "Environment"
}

variable "generated_siri_vm_bucket_name" {
  type = string
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
