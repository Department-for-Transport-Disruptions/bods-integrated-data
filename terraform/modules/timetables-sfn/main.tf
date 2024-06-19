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
data "aws_region" "current" {}

resource "aws_iam_role" "integrated_data_timetables_sfn_role" {
  name = "integrated-data-timetables-sfn-role-${var.environment}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "states.amazonaws.com"
        },
        "Action" : "sts:AssumeRole",
        "Condition" : {
          "StringEquals" : {
            "aws:SourceAccount" : data.aws_caller_identity.current.account_id
          },
          "ArnLike" : {
            "aws:SourceArn" : "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:*"
          }
        }
      }
    ]
  })
}

resource "aws_sfn_state_machine" "integrated_data_timetables_sfn" {
  name     = "integrated-data-timetables-sfn-${var.environment}"
  role_arn = aws_iam_role.integrated_data_timetables_sfn_role.arn
  definition = templatefile("${path.module}/timetables-state-machine.asl.json", {
    db_cleardown_function_arn              = var.db_cleardown_function_arn,
    noc_retriever_function_arn             = var.noc_retriever_function_arn,
    noc_processor_function_arn             = var.noc_processor_function_arn,
    noc_bucket_name                        = var.noc_bucket_name
    naptan_retriever_function_arn          = var.naptan_retriever_function_arn,
    naptan_uploader_function_arn           = var.naptan_uploader_function_arn,
    naptan_bucket_name                     = var.naptan_bucket_name,
    nptg_retriever_function_arn            = var.nptg_retriever_function_arn,
    nptg_uploader_function_arn             = var.nptg_uploader_function_arn,
    nptg_bucket_name                       = var.nptg_bucket_name,
    bank_holidays_retriever_function_arn   = var.bank_holidays_retriever_function_arn,
    bods_txc_retriever_function_arn        = var.bods_txc_retriever_function_arn,
    unzipper_function_arn                  = var.unzipper_function_arn,
    bods_txc_zipped_bucket_name            = var.bods_txc_zipped_bucket_name,
    txc_processor_function_arn             = var.txc_processor_function_arn,
    bods_txc_bucket_name                   = var.bods_txc_bucket_name,
    tnds_txc_bucket_name                   = var.tnds_txc_bucket_name,
    tnds_txc_retriever_function_arn        = var.tnds_txc_retriever_function_arn,
    tnds_txc_zipped_bucket_name            = var.tnds_txc_zipped_bucket_name,
    table_renamer_function_arn             = var.table_renamer_function_arn,
    gtfs_timetables_generator_function_arn = var.gtfs_timetables_generator_function_arn
  })
}

resource "aws_iam_policy" "integrated_data_timetables_sfn_policy" {
  name = "integrated-data-timetables-sfn-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : [
          "lambda:InvokeFunction"
        ],
        "Resource" : [
          var.nptg_retriever_function_arn,
          var.nptg_uploader_function_arn,
          var.noc_retriever_function_arn,
          var.noc_processor_function_arn,
          var.bods_txc_retriever_function_arn,
          var.tnds_txc_retriever_function_arn,
          var.unzipper_function_arn,
          var.txc_processor_function_arn,
          var.gtfs_timetables_generator_function_arn,
          var.db_cleardown_function_arn,
          var.table_renamer_function_arn,
          var.naptan_retriever_function_arn,
          var.naptan_uploader_function_arn,
          var.bank_holidays_retriever_function_arn,
          "${var.nptg_retriever_function_arn}*",
          "${var.nptg_uploader_function_arn}*",
          "${var.noc_retriever_function_arn}*",
          "${var.noc_processor_function_arn}*",
          "${var.bods_txc_retriever_function_arn}*",
          "${var.tnds_txc_retriever_function_arn}*",
          "${var.unzipper_function_arn}*",
          "${var.txc_processor_function_arn}*",
          "${var.gtfs_timetables_generator_function_arn}*",
          "${var.db_cleardown_function_arn}*",
          "${var.table_renamer_function_arn}*",
          "${var.naptan_retriever_function_arn}*",
          "${var.naptan_uploader_function_arn}*",
          "${var.bank_holidays_retriever_function_arn}*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "s3:ListBucket"
        ],
        "Resource" : [
          "arn:aws:s3:::${var.bods_txc_zipped_bucket_name}",
          "arn:aws:s3:::${var.tnds_txc_zipped_bucket_name}",
          "arn:aws:s3:::${var.bods_txc_bucket_name}",
          "arn:aws:s3:::${var.tnds_txc_bucket_name}",
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:RedriveExecution"
        ],
        "Resource" : [
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:execution:${aws_sfn_state_machine.integrated_data_timetables_sfn.name}/*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_timetables_sfn.arn
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:DescribeExecution",
          "states:StopExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_timetables_sfn.arn
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ],
        "Resource" : [
          "*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "integrated_data_timetables_sfn_policy_attachment" {
  policy_arn = aws_iam_policy.integrated_data_timetables_sfn_policy.arn
  role       = aws_iam_role.integrated_data_timetables_sfn_role.name
}

resource "aws_iam_policy" "integrated_data_timetables_sfn_schedule_policy" {
  count = var.schedule != null ? 1 : 0

  name = "integrated-data-timetables-sfn-schedule-policy-${var.environment}"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_timetables_sfn.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "integrated_data_timetables_sfn_schedule_role" {
  count = var.schedule != null ? 1 : 0

  name = "integrated-data-timetables-sfn-schedule-role-${var.environment}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "scheduler.amazonaws.com"
        },
        "Action" : "sts:AssumeRole",
        "Condition" : {
          "StringEquals" : {
            "aws:SourceAccount" : data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  managed_policy_arns = [aws_iam_policy.integrated_data_timetables_sfn_schedule_policy[0].arn]
}

resource "aws_scheduler_schedule" "timetables_sfn_schedule" {
  count = var.schedule != null ? 1 : 0

  name = "integrated-data-timetables-sfn-schedule-${var.environment}"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = var.schedule

  target {
    arn      = aws_sfn_state_machine.integrated_data_timetables_sfn.arn
    role_arn = aws_iam_role.integrated_data_timetables_sfn_schedule_role[0].arn
  }
}
