variable "environment" {
  type        = string
  description = "Environment"
}

variable "unzipped_bucket_name" {
  type        = string
  description = "Name of the bucket to save unzipped files to"
}

variable "unzipped_bucket_arn" {
  type        = string
  description = "ARN of the bucket to save unzipped files to"
}

variable "zipped_bucket_name" {
  type        = string
  description = "Name of the zipped bucket"
}

variable "zipped_bucket_arn" {
  type        = string
  description = "ARN of the zipped bucket"
}

variable "function_name" {
  type        = string
  description = "value"
}
