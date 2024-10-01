locals {
  rds_monitors = {
    RDSBackgroundCPU = {
      query     = "avg(last_6h):avg:aws.rds.cpuutilization{environment:${var.environment}} by {name} > ${local.thresholds.RDSBackgroundCPU}"
      message   = "RDS CPU background average rising on {{name.name}}: {{value}}%"
      threshold = local.thresholds.RDSBackgroundCPU
      recovery  = local.recovery.RDSBackgroundCPU
    }
    RDSCPUSpike = {
      query     = "avg(last_10m):avg:aws.rds.cpuutilization{environment:${var.environment}} by {name} > ${local.thresholds.RDSCPUSpike}"
      message   = "RDS CPU high on {{name.name}}: {{value}}%"
      threshold = local.thresholds.RDSCPUSpike
      recovery  = local.recovery.RDSCPUSpike
    }
    RDSEBSIOBalance = {
      query     = "min(last_1h):avg:aws.rds.ebsiobalance{environment:${var.environment}} by {name} < ${local.thresholds.RDSEBSIOBalance}"
      message   = "RDS EBS IO Balance low on {{name.name}}: {{value}}%"
      threshold = local.thresholds.RDSEBSIOBalance
      recovery  = local.recovery.RDSEBSIOBalance
    }
    RDSReadLatency = {
      query     = "avg(last_5m):avg:aws.rds.read_latency{environment:${var.environment}} by {name} > ${local.thresholds.RDSReadLatency}"
      message   = "RDS Read Latency high on {{name.name}}: {{value}}%"
      threshold = local.thresholds.RDSReadLatency
      recovery  = local.recovery.RDSReadLatency
    }
    RDSWriteLatency = {
      query     = "avg(last_5m):avg:aws.rds.write_latency{environment:${var.environment}} by {name} > ${local.thresholds.RDSWriteLatency}"
      message   = "RDS Write Latency high on {{name.name}}: {{value}}%"
      threshold = local.thresholds.RDSWriteLatency
      recovery  = local.recovery.RDSWriteLatency
    }
  }
}

resource "datadog_monitor" "rds" {
  for_each = { for x, y in local.rds_monitors : x => y if !contains(var.opt_out, x) }

  message = "${each.value.message} ${var.default_alert}"
  name    = "${var.project_name} ${each.key} ${var.environment}"
  query   = each.value.query
  type    = "query alert"

  monitor_thresholds {
    critical          = each.value.threshold
    critical_recovery = each.value.recovery
  }
}
