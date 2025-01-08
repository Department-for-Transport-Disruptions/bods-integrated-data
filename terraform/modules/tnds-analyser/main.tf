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

module "integrated_data_tnds_analysis_table" {
  source = "../shared/dynamo-table"

  environment = var.environment
  table_name  = "integrated-data-tnds-analysis-table"
}

resource "aws_s3_bucket" "integrated_data_tnds_analysis_bucket" {
  bucket = "integrated-data-tnds-analysis-${var.environment}"
}

module "integrated_data_tnds_analysis_cleardown_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-analysis-cleardown"
  zip_path      = "${path.module}/../../../src/functions/dist/tnds-analysis-cleardown.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 128

  permissions = [
    {
      Action   = ["dynamodb:Scan", "dynamodb:BatchWriteItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_tnds_analysis_table.table_name}"
    }
  ]

  env_vars = {
    STAGE                    = var.environment
    TNDS_ANALYSIS_TABLE_NAME = module.integrated_data_tnds_analysis_table.table_name
  }
}

module "integrated_data_tnds_analyser_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-analyser"
  zip_path      = "${path.module}/../../../src/functions/dist/tnds-analyser.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 900
  memory        = 4096

  permissions = [
    {
      Action   = ["dynamodb:BatchWriteItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_tnds_analysis_table.table_name}"
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect   = "Allow",
      Resource = "arn:aws:s3:::${var.tnds_txc_bucket_name}/*"
    }
  ]

  env_vars = {
    STAGE                    = var.environment
    TNDS_ANALYSIS_TABLE_NAME = module.integrated_data_tnds_analysis_table.table_name
  }
}

module "integrated_data_tnds_reporter_function" {
  source = "../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-tnds-reporter"
  zip_path      = "${path.module}/../../../src/functions/dist/tnds-reporter.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory        = 512

  permissions = [
    {
      Action   = ["dynamodb:Scan"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${module.integrated_data_tnds_analysis_table.table_name}"
    },
    {
      Action = [
        "s3:PutObject",
      ],
      Effect   = "Allow",
      Resource = "${aws_s3_bucket.integrated_data_tnds_analysis_bucket.arn}/*"
    }
  ]

  env_vars = {
    STAGE                     = var.environment
    TNDS_ANALYSIS_TABLE_NAME  = module.integrated_data_tnds_analysis_table.table_name
    TNDS_ANALYSIS_BUCKET_NAME = aws_s3_bucket.integrated_data_tnds_analysis_bucket.id
  }
}

resource "aws_iam_role" "integrated_data_tnds_analysis_sfn_role" {
  name = "integrated-data-tnds-analysis-sfn-role-${var.environment}"

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

resource "aws_sfn_state_machine" "integrated_data_tnds_analysis_sfn" {
  name     = "integrated-data-tnds-analysis-sfn-${var.environment}"
  role_arn = aws_iam_role.integrated_data_tnds_analysis_sfn_role.arn
  definition = templatefile("${path.module}/tnds-analysis-state-machine.asl.json", {
    tnds_analysis_cleardown_function_arn = module.integrated_data_tnds_analysis_cleardown_function.function_arn,
    tnds_analyser_function_arn           = module.integrated_data_tnds_analyser_function.function_arn,
    tnds_reporter_function_arn           = module.integrated_data_tnds_reporter_function.function_arn,
    tnds_txc_bucket_name                 = var.tnds_txc_bucket_name
  })
}

resource "aws_iam_policy" "integrated_data_tnds_analysis_sfn_policy" {
  name = "integrated-data-tnds-analysis-sfn-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : [
          "lambda:InvokeFunction"
        ],
        "Resource" : [
          module.integrated_data_tnds_analysis_cleardown_function.function_arn,
          module.integrated_data_tnds_analyser_function.function_arn,
          module.integrated_data_tnds_reporter_function.function_arn,
          "${module.integrated_data_tnds_analysis_cleardown_function.function_arn}*",
          "${module.integrated_data_tnds_analyser_function.function_arn}*",
          "${module.integrated_data_tnds_reporter_function.function_arn}*",
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "s3:ListBucket"
        ],
        "Resource" : [
          "arn:aws:s3:::${var.tnds_txc_bucket_name}"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:RedriveExecution"
        ],
        "Resource" : [
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:execution:${aws_sfn_state_machine.integrated_data_tnds_analysis_sfn.name}/*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_tnds_analysis_sfn.arn
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:DescribeExecution",
          "states:StopExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_tnds_analysis_sfn.arn
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

resource "aws_iam_role_policy_attachment" "integrated_data_tnds_analysis_sfn_policy_attachment" {
  policy_arn = aws_iam_policy.integrated_data_tnds_analysis_sfn_policy.arn
  role       = aws_iam_role.integrated_data_tnds_analysis_sfn_role.name
}
