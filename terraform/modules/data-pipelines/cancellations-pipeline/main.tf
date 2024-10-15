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

module "integrated_data_cancellations_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name                = "integrated-data-cancellations-raw-siri-sx-${var.environment}"
  sqs_name                   = "integrated-data-cancellations-queue-${var.environment}"
  dlq_name                   = "integrated-data-cancellations-dlq-${var.environment}"
  alarm_topic_arn            = var.alarm_topic_arn
  ok_topic_arn               = var.ok_topic_arn
  visibility_timeout_seconds = 60
}

module "integrated_data_cancellations_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-cancellations-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/cancellations-processor.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 60
  memory          = 1024
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      Effect = "Allow",
      Resource = [
        module.integrated_data_cancellations_s3_sqs.sqs_arn
      ]
    },
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${module.integrated_data_cancellations_s3_sqs.bucket_arn}/*"
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
    },
    {
      Action   = ["dynamodb:GetItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.cancellations_subscription_table_name}"
    },
  ]

  env_vars = {
    STAGE                                 = var.environment
    DB_HOST                               = var.db_host
    DB_PORT                               = var.db_port
    DB_SECRET_ARN                         = var.db_secret_arn
    DB_NAME                               = var.db_name
    CANCELLATIONS_SUBSCRIPTION_TABLE_NAME = var.cancellations_subscription_table_name
  }
}

resource "aws_lambda_event_source_mapping" "integrated_data_cancellations_processor_sqs_trigger" {
  event_source_arn = module.integrated_data_cancellations_s3_sqs.sqs_arn
  function_name    = module.integrated_data_cancellations_processor_function.lambda_arn
}

resource "aws_s3_bucket" "integrated_data_cancellations_siri_sx_bucket" {
  bucket = "integrated-data-cancellations-generated-siri-sx-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_cancellations_siri_sx_block_public" {
  bucket = aws_s3_bucket.integrated_data_cancellations_siri_sx_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_cancellations_siri_sx_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_cancellations_siri_sx_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_iam_policy" "siri_sx_generator_ecs_execution_policy" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-sx-generator-ecs-execution-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : "logs:CreateLogGroup",
        "Resource" : [
          "arn:aws:logs:eu-west-2:${data.aws_caller_identity.current.account_id}:log-group:/ecs/siri-sx-generator-${var.environment}:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role" "siri_sx_generator_ecs_execution_role" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-sx-generator-ecs-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "ecs-tasks.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    aws_iam_policy.siri_sx_generator_ecs_execution_policy[0].arn
  ]
}

resource "aws_iam_policy" "siri_sx_generator_ecs_task_policy" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-sx-generator-ecs-task-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : "s3:PutObject",
        "Resource" : [
          "${aws_s3_bucket.integrated_data_cancellations_siri_sx_bucket.arn}/*"
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : "secretsmanager:GetSecretValue",
        "Resource" : [
          var.db_secret_arn
        ]
      },
      {
        "Effect" : "Allow",
        "Action" : "cloudwatch:PutMetricData",
        "Resource" : "*"
      }
    ]
  })
}

resource "aws_iam_role" "siri_sx_generator_ecs_task_role" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-sx-generator-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "ecs-tasks.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })

  managed_policy_arns = [aws_iam_policy.siri_sx_generator_ecs_task_policy[0].arn]
}

resource "aws_security_group" "siri_sx_generator_sg" {
  count = var.environment != "local" ? 1 : 0

  name   = "integrated-data-siri-sx-generator-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "siri_sx_generator_sg_allow_all_egress_ipv4" {
  count = var.environment != "local" ? 1 : 0

  security_group_id = aws_security_group.siri_sx_generator_sg[0].id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "siri_sx_generator_sg_allow_all_egress_ipv6" {
  count = var.environment != "local" ? 1 : 0

  security_group_id = aws_security_group.siri_sx_generator_sg[0].id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

// TODO - Why do we allow lambda ingress?
resource "aws_vpc_security_group_ingress_rule" "db_sg_allow_lambda_ingress" {
  count = var.environment != "local" ? 1 : 0

  security_group_id            = var.db_sg_id
  referenced_security_group_id = aws_security_group.siri_sx_generator_sg[0].id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

resource "aws_ecs_task_definition" "siri_sx_generator_task_definition" {
  count = var.environment != "local" ? 1 : 0

  family                   = "integrated-data-siri-vm-generator"
  cpu                      = var.siri_sx_generator_cpu
  memory                   = var.siri_sx_generator_memory
  requires_compatibilities = ["FARGATE"]
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
  network_mode = "awsvpc"

  task_role_arn      = aws_iam_role.siri_sx_generator_ecs_task_role[0].arn
  execution_role_arn = aws_iam_role.siri_sx_generator_ecs_execution_role[0].arn

  container_definitions = jsonencode([
    {
      "name" : "siri-sx-generator",
      "image" : var.siri_sx_generator_image_url,
      "portMappings" : [],
      "essential" : true,
      "environment" : [
        {
          "name" : "DB_NAME",
          "value" : var.db_name
        },
        {
          "name" : "DB_HOST",
          "value" : var.db_host
        },
        {
          "name" : "DB_READER_HOST",
          "value" : var.db_reader_host
        },
        {
          "name" : "DB_PORT",
          "value" : tostring(var.db_port)
        },
        {
          "name" : "DB_SECRET_ARN",
          "value" : var.db_secret_arn
        },
        {
          "name" : "BUCKET_NAME",
          "value" : aws_s3_bucket.integrated_data_cancellations_siri_sx_bucket.bucket
        },
        {
          "name" : "GENERATOR_FREQUENCY_IN_SECONDS",
          "value" : tostring(var.siri_sx_generator_frequency)
        },
        {
          "name" : "CLEARDOWN_FREQUENCY_IN_SECONDS",
          "value" : tostring(var.situations_cleardown_frequency)
        },
        {
          "name" : "STAGE",
          "value" : var.environment
        }
      ],
      "environmentFiles" : [],
      "mountPoints" : [],
      "volumesFrom" : [],
      "readonlyRootFilesystem" : false,
      "ulimits" : [],
      "logConfiguration" : {
        "logDriver" : "awslogs",
        "options" : {
          "awslogs-create-group" : "true",
          "awslogs-group" : "/ecs/siri-sx-generator-${var.environment}",
          "awslogs-region" : "eu-west-2",
          "awslogs-stream-prefix" : "ecs"
        },
        "secretOptions" : []
      },
      "systemControls" : []
    }
  ])
}

resource "aws_ecs_service" "siri_sx_generator_service" {
  count = var.environment != "local" ? 1 : 0

  name            = "integrated-data-siri-sx-generator-service-${var.environment}"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.siri_sx_generator_task_definition[0].arn
  desired_count   = 1

  capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }

  platform_version    = "1.4.0"
  scheduling_strategy = "REPLICA"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.siri_sx_generator_sg[0].id]
  }

  depends_on = [aws_iam_policy.siri_sx_generator_ecs_task_policy[0]]

  lifecycle {
    ignore_changes = [task_definition]
  }
}
