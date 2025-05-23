variable "environment" {
  type        = string
  description = "Environment"
}

variable "db_subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "multi_az" {
  type        = bool
  description = "Deploy multiple instances across 2 AZs"
  default     = false
}

variable "instance_class" {
  type = string
}

variable "enable_deletion_protection" {
  type    = bool
  default = false
}

variable "private_hosted_zone_id" {
  type        = string
  description = "ID for the private hosted zone"
}

variable "private_hosted_zone_name" {
  type        = string
  description = "Name of the private hosted zone"
}

variable "db_engine_version" {
  type        = string
  description = "DB engine version"
}
