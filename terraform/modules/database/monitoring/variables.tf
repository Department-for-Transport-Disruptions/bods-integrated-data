variable "environment" {
  type        = string
  description = "Environment"
}

variable "db_cluster_id" {
  type        = string
  description = "RDS cluster ID"
}

variable "cpu_utilization_threshold" {
  type        = string
  default     = "80"
  description = "RDS CPU Utilization threshold"
}

variable "freeable_memory_threshold" {
  type        = string
  default     = "1000000000"
  description = "RDS CPU Utilization threshold"
}

variable "email_addresses" {
  description = "List of email address for this subscription."
  type        = list(string)
  default     = []
}

variable "multi_az" {
  type        = bool
  description = "Whether it is a multi-az db deployment or not"
  default     = false
}
