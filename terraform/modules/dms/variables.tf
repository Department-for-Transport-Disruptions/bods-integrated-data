variable "environment" {
  type        = string
  description = "Environment"
}

variable "private_subnet_ids" {
  type = list(string)
}

