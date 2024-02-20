terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }

    archive = {
      source = "hashicorp/archive"
      version = "~> 2.4"

    }
  }
}

resource "aws_cloudwatch_log_group" "lambda_transform_siri_logging_group" {
  name = "/aws/lambda/${local.lambda_name}"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_policy" "lambda_transform_siri_policy" {
  name = "cavl-lambda-transform-siri-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource": ["${aws_cloudwatch_log_group.lambda_transform_siri_logging_group.arn}:*"],
        "Effect": "Allow"
      },
      {
            "Effect": "Allow",
            "Action": [
                "kinesis:DescribeStream",
                "kinesis:DescribeStreamSummary",
                "kinesis:GetRecords",
                "kinesis:GetShardIterator",
                "kinesis:ListShards",
                "kinesis:ListStreams",
                "kinesis:SubscribeToShard",
            ],
            "Resource": ["arn:aws:kinesis:${var.region}:${var.account_id}:stream/${local.kinesis_firehose_stream_name}"]
        }
    ]
  })
}


resource "aws_iam_role" "iam_for_lambda" {
  name               = "cavl-lambda-transform-siri-role-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  managed_policy_arns = [aws_iam_policy.lambda_transform_siri_policy.arn]
}

resource "terraform_data" "lambda_dependencies" {
  triggers_replace = {
    index = sha256(file("${path.root}/../../src/transform-siri/index.ts"))
    package = sha256(file("${path.root}/../../src/package.json"))
    lock = sha256(file("${path.root}/../../src/package-lock.json"))
    ts_files = sha256(join("",fileset(path.root, "../../src/**/*.ts")))
  }

  provisioner "local-exec" {
    command = <<-EOF
      cd ${path.root}/../../src &&\
      npm i &&\
      npm run build
    EOF
  }
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir = "${path.root}/../../src/transform-siri/dist/"
  output_path = "${path.root}/../../src/bundle/transform_siri_vm.zip"
  depends_on = [terraform_data.lambda_dependencies]
}

resource "aws_lambda_function" "lambda_transform_siri" {
  filename      = data.archive_file.lambda_zip.output_path
  function_name = local.lambda_name
  role          = aws_iam_role.iam_for_lambda.arn
  handler       = "dist/index.main"
  timeout       = 10

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  runtime = "nodejs20.x"

  depends_on = [
    aws_iam_policy.lambda_transform_siri_policy
  ]

  //TODO Replace with actual table and schema when created
  environment {
    variables = {
      CAVL_TABLE_NAME = "avl"
      CAVL_TABLE_SCHEMA = "avl_schema"
    }
  }
}

output "lambda_transform_siri_arn" {
  value = aws_lambda_function.lambda_transform_siri.arn
}

locals {
  lambda_name = "cavl-lambda-transform-siri-${var.environment}"
  kinesis_firehose_stream_name = "cavl-kinesis-firehose-stream-${var.environment}"
}