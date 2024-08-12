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

variable "siri_vm_generator_image_url" {
  type        = string
  description = "URL for the SIRI-VM Generator image in ECR"
}

variable "siri_vm_generator_frequency" {
  type        = number
  description = "Frequency in seconds at which to run the SIRI-VM Generator"
}

variable "avl_cleardown_frequency" {
  type        = number
  description = "Frequency in seconds at which to run the AVL Cleardown process"
}

variable "siri_vm_generator_cpu" {
  type        = number
  description = "CPU in MB to assign to the SIRI-VM Generator task"
}

variable "siri_vm_generator_memory" {
  type        = number
  description = "Memory in MB to assign to the SIRI-VM Generator task"
}

variable "siri_vm_downloader_image_url" {
  type        = string
  description = "URL for the SIRI-VM Downloader image in ECR"
}

variable "siri_vm_downloader_cpu" {
  type        = number
  description = "CPU in MB to assign to the SIRI-VM Downloader task"
}

variable "siri_vm_downloader_memory" {
  type        = number
  description = "Memory in MB to assign to the SIRI-VM Downloader task"
}

variable "siri_vm_downloader_desired_task_count" {
  type        = number
  description = "Desired base number of SIRI-VM Downloader tasks"
  default     = 1
}

variable "siri_vm_downloader_nlb_target_group_arn" {
  type        = string
  description = "ARN of the target group which should be associated with the SIRI-VM Downloader tasks"
}

variable "avl_consumer_api_key" {
  type        = string
  description = "AVL consumer API key"
}

variable "nlb_sg_id" {
  type        = string
  description = "ID of the Security Group used by the NLB infront of the SIRI-VM downloader"
}

variable "avl_validation_error_table_name" {
  type        = string
  description = "AVL validation error table name"
}
