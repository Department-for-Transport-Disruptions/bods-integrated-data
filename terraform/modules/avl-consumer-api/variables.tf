variable "environment" {
  type        = string
  description = "Environment"
}

variable "sirivm_downloader_invoke_arn" {
  type = string
}

variable "sirivm_downloader_lambda_name" {
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
