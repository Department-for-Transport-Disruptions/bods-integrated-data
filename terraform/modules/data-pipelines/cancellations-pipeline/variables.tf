variable "environment" {
  type        = string
  description = "Environment"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account id"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "sg_id" {
  type = string
}

variable "ok_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for ok notifications"
}

variable "alarm_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for alarm notifications"
}


variable "db_secret_arn" {
  type        = string
  description = "ARN of the secret containing the database credentials"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "db_name" {
  type    = string
  default = "bods_integrated_data"
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

variable "db_sg_id" {
  type        = string
  description = "Database Security Group ID"
}

variable "siri_sx_generator_image_url" {
  type        = string
  description = "URL for the SIRI-SX Generator image in ECR"
}

variable "siri_sx_generator_frequency" {
  type        = number
  description = "Frequency in seconds at which to run the SIRI-SX Generator"
}

variable "situations_cleardown_frequency" {
  type        = number
  description = "Frequency in seconds at which to run the Situations Cleardown process"
}

variable "siri_sx_generator_cpu" {
  type        = number
  description = "CPU in MB to assign to the SIRI-SX Generator task"
}

variable "siri_sx_generator_memory" {
  type        = number
  description = "Memory in MB to assign to the SIRI-SX Generator task"
}

variable "cluster_id" {
  type = string
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of Subnet IDs"
}

variable "cancellations_subscription_table_name" {
  type        = string
  description = "Cancellations subscription DynamoDB table name"
}
