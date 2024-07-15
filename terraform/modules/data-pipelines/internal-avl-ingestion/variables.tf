variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "lb_subnet_ids" {
  type        = list(string)
  description = "List of Subnet IDs to deploy load balancers into"
}

variable "data_endpoint_function_name" {
  type        = string
  description = "Name of the AVL data endpoint function"
}

variable "external_ip_range" {
  type      = string
  sensitive = true
}
