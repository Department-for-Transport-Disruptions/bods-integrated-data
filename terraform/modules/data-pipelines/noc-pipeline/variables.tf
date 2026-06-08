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
  type    = string
  description = "Name of the external S3 bucket containing NPTG data"
  default     = ""
}

variable "noc__arn" {
  type        = string
  description = "ARN of the IAM role to assume for cross-account S3 access"
  default     = ""
}

variable "bucket_region" {
  type        = string
  description = "Region of the external S3 bucket containing NOC data"
  default     = ""
}

variable "noc_s3_key" {
  type        = string
  description = "S3 key/path of the NPTG XML/CSV file in the external bucket"
  default     = ""
}