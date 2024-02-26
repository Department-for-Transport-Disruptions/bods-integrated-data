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
  name              = "bods-integrated-datards-ok-topic-${var.environment}"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    "STAGE" = var.environment
  }
  tags_all = {
    "STAGE" = var.environment
  }
}

resource "aws_sns_topic" "bods_integrated_data_rds_alarm_topic" {
  name              = "bods-integrated-datards-alarm-topic-${var.environment}"
  kms_master_key_id = "alias/aws/sns"

  tags = {
    "STAGE" = var.environment
  }
  tags_all = {
    "STAGE" = var.environment
  }
}

resource "aws_sns_topic_subscription" "bods_integrated_data_rds_alarm" {
  for_each  = toset(var.email_addresses)
  topic_arn = aws_sns_topic.bods_integrated_data_rds_alarm_topic.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "low_memory" {
  alarm_name          = "bods-integrated-datadb-low-memory-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "600"
  statistic           = "Maximum"
  threshold           = var.freeable_memory_threshold
  alarm_description   = "Database instance memory below threshold"
  alarm_actions       = [aws_sns_topic.bods_integrated_datards_alarm_topic.arn]
  ok_actions          = [aws_sns_topic.bods_integrated_datards_ok_topic.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_endpoint
  }
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "bods-integrated-datadb-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "600"
  statistic           = "Maximum"
  threshold           = var.cpu_utilization_threshold
  alarm_description   = "Database instance CPU above threshold"
  alarm_actions       = [aws_sns_topic.bods_integrated_datards_alarm_topic.arn]
  ok_actions          = [aws_sns_topic.bods_integrated_datards_ok_topic.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_endpoint
  }
}
