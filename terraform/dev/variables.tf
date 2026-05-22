variable "naptan_bucket" {
  type        = string
  description = "Name of the external S3 bucket containing NaPTAN data"
}

variable "naptan_arn" {
  type        = string
  description = "ARN of the IAM role to assume for cross-account S3 access"
  default     = null
}

variable "naptan_bucket_region" {
  type        = string
  description = "Region of the external S3 bucket containing NaPTAN data"
}

variable "naptan_xml_filename" {
  type        = string
  description = "S3 key/path of the NaPTAN XML file in the external bucket"
}


