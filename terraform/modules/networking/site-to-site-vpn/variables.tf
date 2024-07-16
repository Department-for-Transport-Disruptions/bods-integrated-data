variable "environment" {
  type = string
}

variable "vpc_id" {
  type     = string
  nullable = true
  default  = null
}

variable "customer_gateway_ip" {
  type        = string
  description = "IP address for the customer gateway external interface"
}

variable "vpn_name" {
  type        = string
  description = "Name to use for the AWS resources"
}

variable "destination_cidr_block" {
  type        = string
  description = "Static IP ranges to advertise to the VPC"
}

variable "private_route_table_ids" {
  type = set(string)
}

variable "nat_gateway_id" {
  type = string
}
