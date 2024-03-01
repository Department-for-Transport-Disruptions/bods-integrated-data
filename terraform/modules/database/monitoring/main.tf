terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_cloudwatch_metric_alarm" "low_memory" {
  count               = var.multi_az ? 2 : 1
  alarm_name          = "integrated-data-db-${count.index == 0 ? "writer" : "reader"}-low-memory-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = var.freeable_memory_threshold
  alarm_description   = "Database instance memory below threshold"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.ok_topic_arn]

  dimensions = {
    DBClusterIdentifier = var.db_cluster_id
    Role                = count.index == 0 ? "WRITER" : "READER"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count               = var.multi_az ? 2 : 1
  alarm_name          = "integrated-data-db-${count.index == 0 ? "writer" : "reader"}-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "Database instance CPU above threshold"
  alarm_actions       = [var.alarm_topic_arn]
  ok_actions          = [var.ok_topic_arn]

  dimensions = {
    DBClusterIdentifier = var.db_cluster_id
    Role                = count.index == 0 ? "WRITER" : "READER"
  }
}
