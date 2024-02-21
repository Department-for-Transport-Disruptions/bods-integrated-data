variable "environment" {
  type        = string
  description = "Environment"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of Subnet IDs"
}

variable "db_sg_id" {
  type        = string
  description = "Database Security Group ID"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR Block"
}

variable "interface_endpoint_sg_id" {
  type        = string
  description = "ID for the interface endpoint security group"
}
