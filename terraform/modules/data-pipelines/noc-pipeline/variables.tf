variable "environment" {
  type        = string
  description = "Environment"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of Subnet IDs"
}

variable "db_sg_id" {
  type        = string
  description = "Database Security Group ID"
}

variable "db_host" {
  type = string
}

variable "db_port" {
  type    = number
  default = 5432
}

variable "db_secret_arn" {
  type        = string
  description = "ARN of the secret containing the database credentials"
}

variable "db_name" {
  type    = string
  default = "bods_integrated_data"
}

variable "noc_bucket_name" {
  type        = string
  nullable    = true
  default     = null
  description = "External NOC S3 bucket name"
}

variable "noc_role_arn" {
  type        = string
  nullable    = true
  default     = null
  description = "Cross-account IAM role ARN used to access NOC S3"
}

variable "bucket_region" {
  type        = string
  nullable    = true
  default     = null
  description = "Region for the external NOC S3 bucket"
}

variable "noc_s3_key" {
  type        = string
  nullable    = true
  default     = null
  description = "Prefix or object key for NOC XML/CSV in S3"
}
