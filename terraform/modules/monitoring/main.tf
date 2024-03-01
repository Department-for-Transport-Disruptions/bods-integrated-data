terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

data "aws_iam_policy_document" "sns_topic_policy" {
  statement {
    actions = [
      "sns:Publish"
    ]

    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }

    resources = [
      aws_sns_topic.integrated_data_ok_topic.arn,
    ]

    sid = "Allow_Publish_Alarms"
  }
}

resource "aws_sns_topic" "integrated_data_ok_topic" {
  name              = "integrated-data-monitoring-ok-topic-${var.environment}"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_policy" "integrated_data_ok_topic_policy" {
  arn    = aws_sns_topic.integrated_data_ok_topic.arn
  policy = data.aws_iam_policy_document.sns_topic_policy.json
}

resource "aws_sns_topic" "integrated_data_alarm_topic" {
  name              = "integrated-data-monitoring-alarm-topic-${var.environment}"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_policy" "integrated_data_alarm_topic_policy" {
  arn    = aws_sns_topic.integrated_data_alarm_topic.arn
  policy = data.aws_iam_policy_document.sns_topic_policy.json
}

resource "aws_sns_topic_subscription" "integrated_data_alarm_subscription" {
  count     = length(var.email_addresses)
  topic_arn = aws_sns_topic.integrated_data_alarm_topic.arn
  protocol  = "email"
  endpoint  = var.email_addresses[count.index]
}

resource "aws_sns_topic_subscription" "integrated_data_ok_subscription" {
  count     = length(var.email_addresses)
  topic_arn = aws_sns_topic.integrated_data_ok_topic.arn
  protocol  = "email"
  endpoint  = var.email_addresses[count.index]
}
