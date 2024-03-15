terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_avl_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name     = "integrated-data-avl-${var.environment}"
  sqs_name        = "integrated-data-avl-queue-${var.environment}"
  dlq_name        = "integrated-data-avl-dlq-${var.environment}"
  alarm_topic_arn = var.alarm_topic_arn
  ok_topic_arn    = var.ok_topic_arn
}

resource "aws_s3_bucket_public_access_block" "integrated_data_endpoint_s3_bucket_block_public" {
  bucket = aws_s3_bucket.integrated_data_endpoint_s3_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "integrated_data_bods_avl_data_endpoint_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-avl-data-endpoint"
  zip_path      = "${path.module}/../../../src/functions/dist/avl-data-endpoint.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 3072

  permissions = [
    {
      Action = [
        "s3:PutObject"
      ],
      Effect = "Allow",
      Resource = [
        "${module.integrated_data_avl_s3_sqs.bucket_arn}/*"
      ]
    }
  ]

}
