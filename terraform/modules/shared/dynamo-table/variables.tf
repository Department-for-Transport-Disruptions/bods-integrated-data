variable "environment" {
  type        = string
  description = "Environment"
}

variable "table_name" {
  type     = string
  nullable = false
}

variable "ttl_attribute" {
  type        = string
  nullable    = true
  default     = null
  description = "Enable TTL via a TTL attribute name"
}
