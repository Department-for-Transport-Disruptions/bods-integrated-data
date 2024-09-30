terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

data "aws_caller_identity" "current" {}

module "integrated_data_avl_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name                = "integrated-data-cancellations-raw-siri-sx-${var.environment}"
  sqs_name                   = "integrated-data-cancellations-queue-${var.environment}"
  dlq_name                   = "integrated-data-cancellations-dlq-${var.environment}"
  alarm_topic_arn            = var.alarm_topic_arn
  ok_topic_arn               = var.ok_topic_arn
  visibility_timeout_seconds = 60
}
