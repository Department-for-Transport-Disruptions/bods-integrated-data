terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

resource "aws_security_group" "integrated_data_db_migrator_sg" {
  name   = "integrated-data-db-migrator-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_db_migrator_sg_allow_all_egress_ipv4" {
  security_group_id = aws_security_group.integrated_data_db_migrator_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_db_migrator_sg_allow_all_egress_ipv6" {
  security_group_id = aws_security_group.integrated_data_db_migrator_sg.id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_db_sg_allow_lambda_ingress" {
  security_group_id            = var.db_sg_id
  referenced_security_group_id = aws_security_group.integrated_data_db_migrator_sg.id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

resource "aws_iam_role" "integrated_data_db_migrator_role" {
  name = "integrated-data-db-migrator-role-${var.environment}"

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"]
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

resource "aws_lambda_function" "integrated_data_db_migrator_function" {
  function_name    = "integrated-data-db-migrator-${var.environment}"
  filename         = "${path.module}/../../../src/functions/db-migrator/function.zip"
  role             = aws_iam_role.integrated_data_db_migrator_role.arn
  handler          = "migrate.handler"
  source_code_hash = filebase64sha256("${path.module}/../../../src/functions/db-migrator/function.zip")

  runtime     = "nodejs20.x"
  timeout     = 120
  memory_size = 1024

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.integrated_data_db_migrator_sg.id]
  }

  environment {
    variables = {
      DB_HOST       = var.db_host
      DB_PORT       = var.db_port
      DB_SECRET_ARN = var.db_secret_arn
      DB_NAME       = var.db_name
    }
  }
}

resource "aws_lambda_function" "integrated_data_db_migrator_rollback_function" {
  function_name    = "integrated-data-db-migrator-rollback-${var.environment}"
  filename         = "${path.module}/../../../src/functions/db-migrator/function.zip"
  role             = aws_iam_role.integrated_data_db_migrator_role.arn
  handler          = "migrate.handler"
  source_code_hash = filebase64sha256("${path.module}/../../../src/functions/db-migrator/function.zip")

  runtime     = "nodejs20.x"
  timeout     = 120
  memory_size = 1024

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.integrated_data_db_migrator_sg.id]
  }

  environment {
    variables = {
      DB_HOST       = var.db_host
      DB_PORT       = var.db_port
      DB_SECRET_ARN = var.db_secret_arn
      DB_NAME       = var.db_name
      ROLLBACK      = "true"
    }
  }
}
