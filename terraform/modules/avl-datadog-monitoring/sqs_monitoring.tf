# Creates SQS monitor alert
resource "datadog_monitor" "sqs_queue_size" {

  message             = "${each.value.message} ${var.default_alert}"
  name                = "${var.project_name}-${var.environment}"
  type                = "query alert"
  require_full_window = false
  renotify_interval   = 0
  query               = "avg(last_5m):avg:aws.sqs.approximate_number_of_messages_visible{environment:${var.environment}},queuename:${var.project_name}-queue-${var.environment}} > ${var.sqs_critical_threshold}"

  monitor_thresholds {
    critical_recovery = var.sqs_normal_threshold
    critical          = var.sqs_critical_threshold
  }
}
