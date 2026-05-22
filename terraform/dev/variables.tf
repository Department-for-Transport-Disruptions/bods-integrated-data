variable "naptan_bucket" {
  type        = string
  description = "Name of the external S3 bucket containing NaPTAN data"
  default     = "bods-1297-data-landing-zone"
}

variable "naptan_arn" {
  type        = string
  description = "ARN of the IAM role to assume for cross-account S3 access"
  default     = null
}

variable "naptan_bucket_region" {
  type        = string
  description = "Region of the external S3 bucket containing NaPTAN data"
  default     = "eu-west-2"
}

variable "naptan_xml_filename" {
  type        = string
  description = "S3 key/path of the NaPTAN XML file in the external bucket"
  default     = "raw/naptan/naptan-latest_xml.xml"
}


