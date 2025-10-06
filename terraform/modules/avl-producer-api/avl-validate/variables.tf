variable "environment" {
  type        = string
  description = "Environment"
}

variable "avl_producer_api_key_arn" {
  type        = string
  description = "AVL producer API key ARN"
}

variable "sg_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}
