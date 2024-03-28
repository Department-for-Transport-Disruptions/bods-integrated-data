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

variable "tnds_ftp_credentials" {
  type        = map(string)
  description = "TNDS FTP credentials"
}

variable "rds_output_bucket_name" {
  type        = string
  description = "Name of the output bucket for aurora exports"
}
