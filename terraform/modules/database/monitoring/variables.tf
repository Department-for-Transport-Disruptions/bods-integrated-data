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

variable "multi_az" {
  type        = bool
  description = "Whether it is a multi-az db deployment or not"
  default     = false
}

variable "ok_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for ok notifications"
}

variable "alarm_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for alarm notifications"
}
