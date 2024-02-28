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

resource "aws_iam_policy" "integrated_data_avl_processor_policy" {
  name = "integrated-data-avl-processor-policy-${var.environment}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ],
        Effect = "Allow",
        Resource = [
          module.integrated_data_avl_s3_sqs.sqs_arn
        ]
      },
      {
        Action = [
          "s3:GetObject",
        ],
        Effect = "Allow",
        Resource = [
          "${module.integrated_data_avl_s3_sqs.bucket_arn}/*"
        ]
      },
      {
        Action = [
          "secretsmanager:GetSecretValue",
        ],
        Effect = "Allow",
        Resource = [
          var.db_secret_arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "integrated_data_avl_processor_role" {
  name = "integrated-data-avl-processor-role-${var.environment}"

  managed_policy_arns = [aws_iam_policy.integrated_data_avl_processor_policy.arn, "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"]
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "lambda.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_security_group" "integrated_data_avl_processor_sg" {
  name   = "integrated-data-avl-processor-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_avl_processor_sg_allow_all_egress_ipv4" {
  security_group_id = aws_security_group.integrated_data_avl_processor_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_avl_processor_sg_allow_all_egress_ipv6" {
  security_group_id = aws_security_group.integrated_data_avl_processor_sg.id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_db_sg_allow_lambda_ingress" {
  security_group_id            = var.db_sg_id
  referenced_security_group_id = aws_security_group.integrated_data_avl_processor_sg.id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

module "integrated_data_avl_processor_function" {
  source = "../../shared/lambda-function"

  function_name      = "integrated-data-avl-processor-${var.environment}"
  zip_path           = "${path.module}/../../../../src/functions/dist/avl-processor.zip"
  role_arn           = aws_iam_role.integrated_data_avl_processor_role.arn
  handler            = "index.handler"
  runtime            = "nodejs20.x"
  timeout            = 30
  memory             = 1024
  subnet_ids         = var.private_subnet_ids
  security_group_ids = [aws_security_group.integrated_data_avl_processor_sg.id]

  env_vars = {
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

resource "aws_lambda_event_source_mapping" "integrated_data_avl_processor_sqs_trigger" {
  event_source_arn = module.integrated_data_avl_s3_sqs.sqs_arn
  function_name    = module.integrated_data_avl_processor_function.lambda_arn
}
