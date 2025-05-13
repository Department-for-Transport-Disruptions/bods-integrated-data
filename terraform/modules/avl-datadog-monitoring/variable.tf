
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

variable "project_name" {
  type        = string
  description = "The name of the project a resource is associated with."
}

variable "thresholds" {
  type = object({
    RDSBackgroundCPU          = optional(number)
    RDSCPUSpike               = optional(number)
    RDSEBSIOBalance           = optional(number)
    RDSReadLatency            = optional(number)
    RDSWriteLatency           = optional(number)
    APIGWLatency              = optional(number)
    APIGWHTTP4xxErrors        = optional(number)
    APIGWHTTP5xxErrors        = optional(number)
    LambdaErrors              = optional(number)
    LambdaDuration            = optional(number)
    LambdaThrottles           = optional(number)
    LambdaInvocations         = optional(number)
    CloudFrontTotalErrorRate  = optional(number)
    CloudFront4xxErrorRate    = optional(number)
    CloudFront5xxErrorRate    = optional(number)
    CloudFrontBytesDownloaded = optional(number)
    CloudFrontBytesUploaded   = optional(number)
    CloudFrontRequests        = optional(number)
    ElasticacheCPU            = optional(number)
    ElasticacheMemory         = optional(number)
    ElasticacheDBCapcity      = optional(number)
    UnhealthyHostCount        = optional(number)
    TargetResponseTimesLong   = optional(number)
    TargetResponseTimesShort  = optional(number)
    TargetErrorRate           = optional(number)
    ELBErrorRate              = optional(number)
    WAFPctRequestsBlocked     = optional(number)
    ECSThresholdOverrides     = optional(map(map(number)))
  })
}

variable "recovery" {
  type = object({
    RDSBackgroundCPU          = optional(number)
    RDSCPUSpike               = optional(number)
    RDSEBSIOBalance           = optional(number)
    RDSReadLatency            = optional(number)
    RDSWriteLatency           = optional(number)
    APIGWLatency              = optional(number)
    APIGWHTTP4xxErrors        = optional(number)
    APIGWHTTP5xxErrors        = optional(number)
    LambdaErrors              = optional(number)
    LambdaDuration            = optional(number)
    LambdaThrottles           = optional(number)
    LambdaInvocations         = optional(number)
    CloudFrontTotalErrorRate  = optional(number)
    CloudFront4xxErrorRate    = optional(number)
    CloudFront5xxErrorRate    = optional(number)
    CloudFrontBytesDownloaded = optional(number)
    CloudFrontBytesUploaded   = optional(number)
    CloudFrontRequests        = optional(number)
    ElasticacheCPU            = optional(number)
    ElasticacheMemory         = optional(number)
    ElasticacheDBCapcity      = optional(number)
    UnhealthyHostCount        = optional(number)
    TargetResponseTimesLong   = optional(number)
    TargetResponseTimesShort  = optional(number)
    TargetErrorRate           = optional(number)
    ELBErrorRate              = optional(number)
    WAFPctRequestsBlocked     = optional(number)
    ECSThresholdOverrides     = optional(map(map(number)))
  })
}

variable "opt_out" {
  type        = list(string)
  description = "Keys of monitors you wish to suppress"
  default     = []
}

variable "default_alert" {
  type    = string
  default = ""
}

variable "evaluation_delay" {
  type        = number
  description = "Delay in seconds for the metric evaluation"
  default     = 900
}

variable "new_group_delay" {
  type        = number
  description = "Delay in seconds before monitor new resource"
  default     = 300
}

locals {
  thresholds = {
    RDSBackgroundCPU = coalesce(var.thresholds.RDSBackgroundCPU, 25)
    RDSCPUSpike      = coalesce(var.thresholds.RDSCPUSpike, 40)
    RDSEBSIOBalance  = coalesce(var.thresholds.RDSEBSIOBalance, 5)
    RDSReadLatency   = coalesce(var.thresholds.RDSReadLatency, 0.01)
    RDSWriteLatency  = coalesce(var.thresholds.RDSWriteLatency, 0.1)

    APIGWLatency       = coalesce(var.thresholds.APIGWLatency, 3000)
    APIGWHTTP4xxErrors = coalesce(var.thresholds.APIGWHTTP4xxErrors, 30)
    APIGWHTTP5xxErrors = coalesce(var.thresholds.APIGWHTTP4xxErrors, 20)

    LambdaErrors      = coalesce(var.thresholds.LambdaErrors, 5)
    LambdaDuration    = coalesce(var.thresholds.LambdaDuration, 300000)
    LambdaThrottles   = coalesce(var.thresholds.LambdaThrottles, 10)
    LambdaInvocations = coalesce(var.thresholds.LambdaInvocations, 1000)

    CloudFrontTotalErrorRate  = coalesce(var.thresholds.CloudFrontTotalErrorRate, 2)
    CloudFront4xxErrorRate    = coalesce(var.thresholds.CloudFront4xxErrorRate, 2)
    CloudFront5xxErrorRate    = coalesce(var.thresholds.CloudFront5xxErrorRate, 2)
    CloudFrontBytesDownloaded = coalesce(var.thresholds.CloudFrontBytesDownloaded, 1000000000)
    CloudFrontBytesUploaded   = coalesce(var.thresholds.CloudFrontBytesUploaded, 1000000000)
    CloudFrontBytesDownloaded = coalesce(var.thresholds.CloudFrontBytesDownloaded, 1000000000)
    CloudFrontRequests        = coalesce(var.thresholds.CloudFrontRequests, 10000)

    ElasticacheCPU        = coalesce(var.thresholds.ElasticacheCPU, 5)
    ElasticacheMemory     = coalesce(var.thresholds.ElasticacheMemory, 50)
    ElasticacheDBCapacity = coalesce(var.thresholds.ElasticacheDBCapcity, 50)

    UnhealthyHostCount       = coalesce(var.thresholds.UnhealthyHostCount, 0.1)
    TargetResponseTimesLong  = coalesce(var.thresholds.TargetResponseTimesLong, 1)
    TargetResponseTimesShort = coalesce(var.thresholds.TargetResponseTimesShort, 20)
    TargetErrorRate          = coalesce(var.thresholds.TargetErrorRate, 4)
    ELBErrorRate             = coalesce(var.thresholds.ELBErrorRate, 15)
    WAFPctRequestsBlocked    = coalesce(var.thresholds.WAFPctRequestsBlocked, 15)
    ECSThresholdOverrides    = coalesce(var.thresholds.ECSThresholdOverrides, {})
  }

  recovery = {
    RDSBackgroundCPU = coalesce(var.recovery.RDSBackgroundCPU, 12)
    RDSCPUSpike      = coalesce(var.recovery.RDSCPUSpike, 20)
    RDSEBSIOBalance  = coalesce(var.recovery.RDSEBSIOBalance, 90)
    RDSReadLatency   = coalesce(var.recovery.RDSReadLatency, 0.005)
    RDSWriteLatency  = coalesce(var.recovery.RDSWriteLatency, 0.05)

    APIGWLatency       = coalesce(var.thresholds.APIGWLatency, 1000)
    APIGWHTTP4xxErrors = coalesce(var.thresholds.APIGWHTTP4xxErrors, 15)
    APIGWHTTP5xxErrors = coalesce(var.thresholds.APIGWHTTP4xxErrors, 10)

    LambdaErrors      = coalesce(var.thresholds.LambdaErrors, 1)
    LambdaDuration    = coalesce(var.thresholds.LambdaDuration, 3600)
    LambdaThrottles   = coalesce(var.thresholds.LambdaThrottles, 3)
    LambdaInvocations = coalesce(var.thresholds.LambdaInvocations, 200)

    CloudFrontTotalErrorRate  = coalesce(var.thresholds.CloudFrontTotalErrorRate, 0)
    CloudFront4xxErrorRate    = coalesce(var.thresholds.CloudFront4xxErrorRate, 0)
    CloudFront5xxErrorRate    = coalesce(var.thresholds.CloudFront5xxErrorRate, 0)
    CloudFrontBytesDownloaded = coalesce(var.thresholds.CloudFrontBytesDownloaded, 50000000)
    CloudFrontBytesUploaded   = coalesce(var.thresholds.CloudFrontBytesUploaded, 50000000)
    CloudFrontBytesDownloaded = coalesce(var.thresholds.CloudFrontBytesDownloaded, 50000000)
    CloudFrontRequests        = coalesce(var.thresholds.CloudFrontRequests, 3000)

    ElasticacheCPU        = coalesce(var.recovery.ElasticacheCPU, 3)
    ElasticacheMemory     = coalesce(var.recovery.ElasticacheMemory, 40)
    ElasticacheDBCapacity = coalesce(var.recovery.ElasticacheDBCapcity, 40)

    UnhealthyHostCount       = coalesce(var.recovery.UnhealthyHostCount, 0)
    TargetResponseTimesLong  = coalesce(var.recovery.TargetResponseTimesLong, 0.75)
    TargetResponseTimesShort = coalesce(var.recovery.TargetResponseTimesShort, 1)
    TargetErrorRate          = coalesce(var.recovery.TargetErrorRate, 1)
    ELBErrorRate             = coalesce(var.recovery.ELBErrorRate, 5)
    WAFPctRequestsBlocked    = coalesce(var.recovery.WAFPctRequestsBlocked, 5)
    ECSThresholdOverrides    = coalesce(var.recovery.ECSThresholdOverrides, {})
  }
}

variable "sqs_critical_threshold" {
  type        = number
  description = "The monitor critical threshold"
  default     = 10
}

variable "sqs_normal_threshold" {
  type        = number
  description = "The normal length of the queue"
  default     = 0
}
