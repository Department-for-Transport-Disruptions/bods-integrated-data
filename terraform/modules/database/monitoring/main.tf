terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_sns_topic" "bods_integrated_data_rds_ok_topic" {
  name              = "bods-integrated-data-rds-ok-topic-${var.environment}"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    "STAGE" = var.environment
  }
  tags_all = {
    "STAGE" = var.environment
  }
}

resource "aws_sns_topic" "bods_integrated_data_rds_alarm_topic" {
  name              = "bods-integrated-data-rds-alarm-topic-${var.environment}"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    "STAGE" = var.environment
  }
  tags_all = {
    "STAGE" = var.environment
  }
}

resource "aws_sns_topic_subscription" "bods_integrated_data_rds_alarm" {
  count     = length(var.email_addresses)
  topic_arn = aws_sns_topic.bods_integrated_data_rds_alarm_topic.arn
  protocol  = "email"
  endpoint  = var.email_addresses[count.index]
}

resource "aws_cloudwatch_metric_alarm" "low_memory_writer" {
  count               = var.multi_az ? 2 : 1
  alarm_name          = "bods-integrated-data-db-${count.index == 0 ? "writer" : "reader"}-low-memory-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = var.freeable_memory_threshold
  alarm_description   = "Database instance memory below threshold"
  alarm_actions       = [aws_sns_topic.bods_integrated_data_rds_alarm_topic.arn]
  ok_actions          = [aws_sns_topic.bods_integrated_data_rds_ok_topic.arn]

  dimensions = {
    DBClusterIdentifier = var.db_cluster_id
    Role                = count.index == 0 ? "WRITER" : "READER"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_cpu_writer" {
  count               = var.multi_az ? 2 : 1
  alarm_name          = "bods-integrated-data-db-${count.index == 0 ? "writer" : "reader"}-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "Database instance CPU above threshold"
  alarm_actions       = [aws_sns_topic.bods_integrated_data_rds_alarm_topic.arn]
  ok_actions          = [aws_sns_topic.bods_integrated_data_rds_ok_topic.arn]

  dimensions = {
    DBClusterIdentifier = var.db_cluster_id
    Role                = count.index == 0 ? "WRITER" : "READER"
  }
}
