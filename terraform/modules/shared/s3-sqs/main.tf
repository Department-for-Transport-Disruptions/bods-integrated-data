terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

data "aws_iam_policy_document" "sqs_queue_policy" {
  statement {
    effect = "Allow"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.queue.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_s3_bucket.bucket.arn]
    }
  }
}

resource "aws_s3_bucket" "bucket" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "s3_bucket_block_public" {
  bucket = aws_s3_bucket.bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_notification" "s3_bucket_sqs_notification" {
  bucket = aws_s3_bucket.bucket.id

  queue {
    queue_arn = aws_sqs_queue.queue.arn
    events    = ["s3:ObjectCreated:*"]
  }
}

resource "aws_sqs_queue" "queue" {
  name                       = var.sqs_name
  sqs_managed_sse_enabled    = true
  visibility_timeout_seconds = var.visibility_timeout_seconds
}

resource "aws_sqs_queue" "dlq" {
  count                   = var.dlq_name != null ? 1 : 0
  name                    = var.dlq_name
  sqs_managed_sse_enabled = true
}

resource "aws_sqs_queue_redrive_policy" "queue_redrive_policy" {
  count     = var.dlq_name != null ? 1 : 0
  queue_url = aws_sqs_queue.queue.id

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[0].arn
    maxReceiveCount     = 4
  })
}

resource "aws_sqs_queue_policy" "sqs_queue_policy" {
  queue_url = aws_sqs_queue.queue.id
  policy    = data.aws_iam_policy_document.sqs_queue_policy.json
}

resource "aws_sqs_queue_redrive_allow_policy" "sqs_redrive_allow_policy" {
  count     = var.dlq_name != null ? 1 : 0
  queue_url = aws_sqs_queue.dlq[0].id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue",
    sourceQueueArns   = [aws_sqs_queue.queue.arn]
  })
}

resource "aws_cloudwatch_metric_alarm" "dlq_new_message_alarm" {
  count               = var.dlq_name != null ? 1 : 0
  alarm_name          = "${var.dlq_name}-new-message-alarm"
  statistic           = "Sum"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  period              = 60
  evaluation_periods  = 1
  namespace           = "AWS/SQS"
  dimensions = {
    QueueName = aws_sqs_queue.dlq[0].name
  }
  alarm_actions = [var.alarm_topic_arn]
  ok_actions    = [var.ok_topic_arn]
}
