variable "environment" {
  type        = string
  description = "Environment"
}

variable "email_addresses" {
  description = "List of email addresses to subscribe to alarm topics"
  type        = list(string)
  default     = []
}
