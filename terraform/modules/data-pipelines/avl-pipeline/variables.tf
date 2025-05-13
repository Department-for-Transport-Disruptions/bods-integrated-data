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

variable "ok_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for ok notifications"
}

variable "alarm_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for alarm notifications"
}

variable "tfl_api_keys" {
  type        = map(string)
  description = "TfL API keys"
}

variable "tfl_location_retriever_invoke_every_seconds" {
  type        = number
  description = "Invoke the TfL location retriever every X seconds"
}

variable "avl_subscription_table_name" {
  type        = string
  description = "AVL Subscription DynamoDB table name"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account id"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}


variable "siri_vm_generator_frequency" {
  type        = number
  description = "Frequency in seconds at which to run the SIRI-VM Generator"
}

variable "avl_validation_error_table_name" {
  type        = string
  description = "AVL validation error table name"
}

variable "gtfs_trip_maps_table_name" {
  type        = string
  description = "GTFS trip maps table name"
}

variable "gtfs_rt_bucket_name" {
  type        = string
  description = "GTFS-RT bucket name"
}

variable "gtfs_rt_bucket_arn" {
  type        = string
  description = "GTFS-RT bucket ARN"
}

variable "save_json" {
  type        = bool
  description = "Whether or not to save the GTFS-RT as JSON as well"
}

variable "abods_account_ids" {
  type        = list(string)
  description = "List of ABODS account IDs to allow access to SIRI-VM bucket"
}

variable "enable_cancellations" {
  type        = bool
  description = "Feature flag for VehicleActivityCancellation work"
  default     = false
}
