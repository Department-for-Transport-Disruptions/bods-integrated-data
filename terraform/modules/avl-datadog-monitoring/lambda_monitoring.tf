locals {
  lambda_monitors = {
    LambdaErrors = {
      query     = "avg(last_5m):sum:aws.lambda.errors{environment:${var.environment},projectname:${var.project_name}} by {functionname}.as_rate() > ${local.thresholds.LambdaErrors}"
      message   = "Lambda function has high error rate: {{functionname.name}}"
      threshold = local.thresholds.LambdaErrors
      recovery  = local.recovery.LambdaErrors
    }
    LambdaDuration = {
      query     = "avg(last_5m):max:aws.lambda.duration{environment:${var.environment},projectname:${var.project_name}} by {functionname} > ${local.thresholds.LambdaDuration}"
      message   = "Lambda function duration is high: {{functionname.name}}"
      threshold = local.thresholds.LambdaDuration
      recovery  = local.recovery.LambdaDuration
    }
    LambdaThrottles = {
      query     = "avg(last_5m):sum:aws.lambda.throttles{environment:${var.environment},projectname:${var.project_name}} by {functionname} > ${local.thresholds.LambdaThrottles}"
      message   = "Lambda function is throttling: {{functionname.name}}"
      threshold = local.thresholds.LambdaThrottles
      recovery  = local.recovery.LambdaThrottles
    }
    LambdaInvocations = {
      query     = "avg(last_5m):sum:aws.lambda.invocations{environment:${var.environment},projectname:${var.project_name}} by {functionname} > ${local.thresholds.LambdaInvocations}"
      message   = "Lambda function invocations are high: {{functionname.name}}"
      threshold = local.thresholds.LambdaInvocations
      recovery  = local.recovery.LambdaInvocations
    }
  }
}

resource "datadog_monitor" "lambda" {
  for_each = { for x, y in local.lambda_monitors : x => y if !contains(var.opt_out, x) }

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
}
