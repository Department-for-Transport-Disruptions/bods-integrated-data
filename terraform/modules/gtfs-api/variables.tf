variable "environment" {
  type        = string
  description = "Environment"
}

variable "gtfs_downloader_invoke_arn" {
  type = string
}

variable "gtfs_downloader_lambda_name" {
  type = string
}

variable "gtfs_region_retriever_invoke_arn" {
  type = string
}

variable "gtfs_region_retriever_lambda_name" {
  type = string
}

variable "gtfs_rt_downloader_invoke_arn" {
  type = string
}

variable "gtfs_rt_downloader_lambda_name" {
  type = string
}

variable "gtfs_rt_service_alerts_downloader_invoke_arn" {
  type = string
}

variable "gtfs_rt_service_alerts_downloader_lambda_name" {
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
