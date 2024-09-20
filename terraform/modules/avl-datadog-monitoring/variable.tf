
variable "environment" {
  type        = string
  description = "The environment into which the resource is deployed, e.g. dev, test, prod."
}

variable "datadog_api_url" {
  type        = string
  description = "The URL that is used to send information to DataDog"
  default     = "https://app.datadoghq.eu"
}

variable "datadog_api_key" {
  type        = string
  description = "API key required by DataDog to submit metrics and events"
}

variable "datadog_app_key" {
  type        = string
  description = "Used in conjunction with the API key to give users access to DataDog's programmatic API"
}

variable "datadog_external_id" {
  type        = string
  description = "Used for Datadog AWS Integration"
  default     = ""
}
