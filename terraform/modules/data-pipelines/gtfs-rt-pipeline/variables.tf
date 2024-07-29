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

variable "cluster_id" {
  type = string
}

variable "bods_avl_processor_image_url" {
  type        = string
  description = "URL for the BODS AVL Processor image in ECR"
}

variable "bods_avl_processor_frequency" {
  type        = number
  description = "Frequency in seconds at which to run the BODS AVL Processor"
}

variable "bods_avl_cleardown_frequency" {
  type        = number
  description = "Frequency in seconds at which to run the BODS AVL Cleardown process"
}

variable "bods_avl_processor_cpu" {
  type        = number
  description = "CPU in MB to assign to the BODS AVL Processor task"
}

variable "bods_avl_processor_memory" {
  type        = number
  description = "Memory in MB to assign to the BODS AVL Processor task"
}
