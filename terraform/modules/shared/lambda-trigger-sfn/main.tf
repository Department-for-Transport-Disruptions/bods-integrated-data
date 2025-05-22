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

resource "aws_iam_role" "integrated_data_lambda_trigger_sfn_role" {
  name = "${var.step_function_name}-sfn-role-${var.environment}"

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

resource "aws_sfn_state_machine" "integrated_data_lambda_trigger_sfn" {
  name     = "${var.step_function_name}-sfn-${var.environment}"
  role_arn = aws_iam_role.integrated_data_lambda_trigger_sfn_role.arn
  definition = templatefile("${path.module}/lambda-trigger-state-machine.asl.json", {
    function_arn         = var.function_arn
    invoke_every_seconds = var.invoke_every_seconds
    invokes_per_minute   = range(60 / var.invoke_every_seconds)
  })
}

resource "aws_iam_policy" "integrated_data_lambda_trigger_sfn_policy" {
  name = "${var.step_function_name}-sfn-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : [
          "lambda:InvokeFunction"
        ],
        "Resource" : [
          var.function_arn,
          "${var.function_arn}*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:RedriveExecution"
        ],
        "Resource" : [
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:execution:${aws_sfn_state_machine.integrated_data_lambda_trigger_sfn.name}/*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:StartExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_lambda_trigger_sfn.arn
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : [
          "states:DescribeExecution",
          "states:StopExecution"
        ],
        "Resource" : [
          aws_sfn_state_machine.integrated_data_lambda_trigger_sfn.arn
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

resource "aws_iam_role_policy_attachment" "integrated_data_lambda_trigger_sfn_policy_attachment" {
  policy_arn = aws_iam_policy.integrated_data_lambda_trigger_sfn_policy.arn
  role       = aws_iam_role.integrated_data_lambda_trigger_sfn_role.name
}


resource "aws_iam_role" "sfn_event_bridge_role" {
  name = "${var.step_function_name}-sfn-eb-role-${var.environment}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "events.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "allow_event_bridge_to_run_sfn_policy" {
  name = "${var.step_function_name}-sfn-eb-policy-${var.environment}"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Action" : ["states:StartExecution"],
        "Resource" : [aws_sfn_state_machine.integrated_data_lambda_trigger_sfn.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "sfn_eventbridge_policy_attachment" {
  role       = aws_iam_role.sfn_event_bridge_role.id
  policy_arn = aws_iam_policy.allow_event_bridge_to_run_sfn_policy.arn
}


resource "aws_cloudwatch_event_rule" "lambda_trigger_sfn_schedule" {
  name                = "schedule-${aws_sfn_state_machine.integrated_data_lambda_trigger_sfn.name}"
  description         = "Schedule for ${aws_sfn_state_machine.integrated_data_lambda_trigger_sfn.name}"
  schedule_expression = "rate(1 minute)"
  state               = var.disable_trigger ? "DISABLED" : "ENABLED"
}

resource "aws_cloudwatch_event_target" "schedule_lambda_trigger_sfn" {
  rule     = aws_cloudwatch_event_rule.lambda_trigger_sfn_schedule.name
  arn      = aws_sfn_state_machine.integrated_data_lambda_trigger_sfn.arn
  role_arn = aws_iam_role.sfn_event_bridge_role.arn
}
