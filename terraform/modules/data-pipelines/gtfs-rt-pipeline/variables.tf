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

variable "db_reader_host" {
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

variable "gtfs_rt_service_alerts_bucket_name" {
  type        = string
  description = "Name of bucket containing service alerts file"
}

variable "gtfs_rt_service_alerts_bucket_arn" {
  type        = string
  description = "Arn of bucket containing service alerts file"
}

variable "siri_vm_bucket_name" {
  type        = string
  description = "Name of bucket containing the AVL SIRI-VM file"
}

variable "siri_vm_bucket_arn" {
  type        = string
  description = "Arn of bucket containing the AVL SIRI-VM file"
}

variable "save_json" {
  type        = bool
  description = "Whether or not to save the GTFS-RT as JSON as well"
}
