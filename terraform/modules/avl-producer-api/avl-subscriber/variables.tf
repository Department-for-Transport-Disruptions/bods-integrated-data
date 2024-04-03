variable "environment" {
  type        = string
  description = "Environment"
}

variable avl_subscription_table_name {
  type        = string
  description = "AVL Subscription DynamoDB table name"
}

variable avl_local_data_producer_endpoint {
  type        = string
  description = "Endpoint for the mock data producer when running locally"
  default     = ""
  nullable    = true
}