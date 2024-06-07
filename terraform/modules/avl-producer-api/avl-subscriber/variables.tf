variable "environment" {
    type        = string
    description = "Environment"
}

variable avl_subscription_table_name {
    type        = string
    description = "AVL Subscription DynamoDB table name"
}

variable avl_mock_data_producer_subscribe_endpoint {
    type        = string
    nullable    = true
    default     = null
    description = "URL for the mock data producer subscribe endpoint"
}

variable avl_data_endpoint {
    type        = string
    description = "HTTP API endpoint URL for the AVL Producer /data endpoint"
}

variable aws_account_id {
    type        = string
    description = "AWS account id"
}

variable aws_region {
    type        = string
    description = "AWS region"
}

variable sg_id {
    type = string
}

variable subnet_ids {
    type = list(string)
}
