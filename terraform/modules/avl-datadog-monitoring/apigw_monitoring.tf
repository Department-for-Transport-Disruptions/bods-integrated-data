locals {
  apigw_monitors = {
    APIGWLatency = {
      query     = "min(last_5m):default(avg:aws.apigateway.latency{stage:${var.environment}} by {region,apiname,stage}, 0) > ${local.thresholds.APIGWLatency}"
      message   = "API Gateway High Response Time (latency) on {{apiname.name}}"
      threshold = local.thresholds.APIGWLatency
      recovery  = local.recovery.APIGWLatency
      timeout_h = 0
    }
    APIGWHTTP4xxErrors = {
      query     = "min(last_5m):default(avg:aws.apigateway.4xxerror{stage:${var.environment}} by {region,apiname,stage}.as_rate(), 0) / (default(avg:aws.apigateway.count{stage:${var.environment}} by {region,apiname,stage}.as_rate() + 5, 1)) * 100 > ${local.thresholds.APIGWHTTP4xxErrors}"
      message   = "API Gateway Elevated 4XX Error Rate for REST API {{apiname.name}}"
      threshold = local.thresholds.APIGWHTTP4xxErrors
      recovery  = local.recovery.APIGWHTTP4xxErrors
      timeout_h = 1
    }
    APIGWHTTP5xxErrors = {
      query     = "min(last_5m):default(avg:aws.apigateway.5xxerror{stage:${var.environment}} by {region,apiname,stage}.as_rate(), 0) / (default(avg:aws.apigateway.count{stage:${var.environment}} by {region,apiname,stage}.as_rate() + 5, 1)) * 100 > ${local.thresholds.APIGWHTTP5xxErrors}"
      message   = "API Gateway Elevated 4XX Error Rate for REST API {{apiname.name}}"
      threshold = local.thresholds.APIGWHTTP5xxErrors
      recovery  = local.recovery.APIGWHTTP5xxErrors
      timeout_h = 1
    }
  }
}

resource "datadog_monitor" "apigw" {
  for_each = { for x, y in local.apigw_monitors : x => y if !contains(var.opt_out, x) }

  message = "${each.value.message} ${var.default_alert}"
  name    = "${var.project_name} ${each.key} ${var.environment}"
  query   = each.value.query
  type    = "query alert"

  monitor_thresholds {
    critical          = each.value.threshold
    critical_recovery = each.value.recovery
  }

  evaluation_delay    = var.evaluation_delay
  new_group_delay     = var.new_group_delay
  renotify_interval   = 0
  require_full_window = false
  timeout_h           = each.value.timeout_h
}
