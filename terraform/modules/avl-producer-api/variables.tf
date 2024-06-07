variable "environment" {
    type        = string
    description = "Environment"
}

variable avl_subscription_table_name {
    type        = string
    description = "AVL Subscription DynamoDB table name"
}

variable aws_account_id {
    type        = string
    description = "AWS account id"
}

variable aws_region {
    type        = string
    description = "AWS region"
}

variable avl_siri_bucket_name {
    type        = string
    description = "Bucket Name for SIRI-VM data"
}

variable sg_id {
    type        = string
    description = "Security group ID"
}

variable subnet_ids {
    type = list(string)
}
