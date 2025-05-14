terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  txc_observation_table_name = "integrated-data-txc-observation-table-${var.environment}"
}

resource "aws_s3_bucket" "integrated_data_txc_analysis_bucket" {
  bucket = "integrated-data-txc-analysis-${var.environment}"
}

module "integrated_data_txc_analysis_cleardown_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-txc-analysis-cleardown"
  zip_path      = "${path.module}/../../../src/functions/dist/txc-analysis-cleardown.zip"
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 60
  memory        = 256

  permissions = [
    {
      Action   = ["dynamodb:CreateTable", "dynamodb:DeleteTable", "dynamodb:DescribeTable"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${local.txc_observation_table_name}"
    }
  ]

  env_vars = {
    STAGE                      = var.environment
    TXC_OBSERVATION_TABLE_NAME = local.txc_observation_table_name
  }
}

module "integrated_data_txc_analyser_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-txc-analyser"
  zip_path      = "${path.module}/../../../src/functions/dist/txc-analyser.zip"
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 60
  memory        = 4096

  permissions = [
    {
      Action   = ["dynamodb:BatchWriteItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${local.txc_observation_table_name}"
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "arn:aws:s3:::${var.bods_txc_bucket_name}/*",
        "arn:aws:s3:::${var.tnds_txc_bucket_name}/*",
        "arn:aws:s3:::${var.naptan_bucket_name}/*",
        "arn:aws:s3:::${var.nptg_bucket_name}/*"
      ]
    }
  ]

  env_vars = {
    STAGE                      = var.environment
    TXC_OBSERVATION_TABLE_NAME = local.txc_observation_table_name
    NAPTAN_BUCKET_NAME         = var.naptan_bucket_name
    NPTG_BUCKET_NAME           = var.nptg_bucket_name
    TZ                         = "Europe/London"
  }
}

module "integrated_data_txc_analysis_reporter_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-txc-analysis-reporter"
  zip_path      = "${path.module}/../../../src/functions/dist/txc-analysis-reporter.zip"
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 900
  memory        = 4096

  permissions = [
    {
      Action   = ["dynamodb:Scan"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${local.txc_observation_table_name}"
    },
    {
      Action = [
        "s3:PutObject",
      ],
      Effect   = "Allow",
      Resource = "${aws_s3_bucket.integrated_data_txc_analysis_bucket.arn}/*"
    }
  ]

  env_vars = {
    STAGE                      = var.environment
    TXC_OBSERVATION_TABLE_NAME = local.txc_observation_table_name
    TXC_ANALYSIS_BUCKET_NAME   = aws_s3_bucket.integrated_data_txc_analysis_bucket.id
  }
}

resource "aws_iam_role" "integrated_data_txc_analysis_sfn_role" {
  name = "integrated-data-txc-analysis-sfn-role-${var.environment}"

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

resource "aws_sfn_state_machine" "integrated_data_txc_analysis_sfn" {
  name     = "integrated-data-txc-analysis-sfn-${var.environment}"
  role_arn = aws_iam_role.integrated_data_txc_analysis_sfn_role.arn
  definition = templatefile("${path.module}/txc-analysis-state-machine.asl.json", {
    txc_analysis_cleardown_function_arn = module.integrated_data_txc_analysis_cleardown_function.function_arn,
    txc_analyser_function_arn           = module.integrated_data_txc_analyser_function.function_arn,
    txc_analysis_reporter_function_arn  = module.integrated_data_txc_analysis_reporter_function.function_arn,
    bods_txc_bucket_name                = var.bods_txc_bucket_name
    tnds_txc_bucket_name                = var.tnds_txc_bucket_name
  })
}

resource "aws_iam_policy" "integrated_data_txc_analysis_sfn_policy" {
  name = "integrated-data-txc-analysis-sfn-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : [
          "lambda:InvokeFunction"
        ],
        "Resource" : [
          module.integrated_data_txc_analysis_cleardown_function.function_arn,
          module.integrated_data_txc_analyser_function.function_arn,
          module.integrated_data_txc_analysis_reporter_function.function_arn,
          "${module.integrated_data_txc_analysis_cleardown_function.function_arn}*",
          "${module.integrated_data_txc_analyser_function.function_arn}*",
          "${module.integrated_data_txc_analysis_reporter_function.function_arn}*",
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "s3:ListBucket"
        ],
        "Resource" : [
          "arn:aws:s3:::${var.bods_txc_bucket_name}",
          "arn:aws:s3:::${var.tnds_txc_bucket_name}"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:RedriveExecution"
        ],
        "Resource" : [
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:execution:${aws_sfn_state_machine.integrated_data_txc_analysis_sfn.name}/*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_txc_analysis_sfn.arn
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:DescribeExecution",
          "states:StopExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_txc_analysis_sfn.arn
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

resource "aws_iam_role_policy_attachment" "integrated_data_txc_analysis_sfn_policy_attachment" {
  policy_arn = aws_iam_policy.integrated_data_txc_analysis_sfn_policy.arn
  role       = aws_iam_role.integrated_data_txc_analysis_sfn_role.name
}
