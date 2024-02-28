variable "bucket_name" {
  type        = string
  description = "Name of the bucket"
}

variable "sqs_name" {
  type        = string
  description = "Name of the SQS queue"
  nullable    = true
  default     = null
}

variable "dlq_name" {
  type        = string
  description = "Name of the SQS DLQ"
}

variable "ok_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for ok notifications"
}

variable "alarm_topic_arn" {
  type        = string
  description = "ARN of the SNS topic to use for alarm notifications"
}
