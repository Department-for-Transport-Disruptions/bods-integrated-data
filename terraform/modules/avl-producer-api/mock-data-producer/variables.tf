variable "environment" {
  type        = string
  description = "Environment"
}

variable "avl_consumer_data_endpoint_url_local" {
  type        = string
  description = "Function url for the AVL service /data endpoint for local development"
  default     = null
  nullable    = true
}

variable "avl_subscription_table_name" {
  type        = string
  description = "Table name for AVL subscriptions"
}