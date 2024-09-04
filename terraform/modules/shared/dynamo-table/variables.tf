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

variable "global_secondary_index" {
  type        = string
  nullable    = true
  default     = null
  description = "Global secondary index as hash key"
}
