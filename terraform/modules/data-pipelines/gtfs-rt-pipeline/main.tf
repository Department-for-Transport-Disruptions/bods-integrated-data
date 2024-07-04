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

resource "aws_s3_bucket" "integrated_data_gtfs_rt_bucket" {
  bucket = "integrated-data-gtfs-rt-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_gtfs_rt_bucket_block_public_access" {
  bucket = aws_s3_bucket.integrated_data_gtfs_rt_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_gtfs_rt_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_gtfs_rt_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

module "integrated_data_gtfs_rt_downloader_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-gtfs-rt-downloader-2"
  zip_path        = "${path.module}/../../../../src/functions/dist/gtfs-rt-downloader.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 120
  memory          = 1024
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "s3:GetObject",
      ],
      Effect = "Allow",
      Resource = [
        "${aws_s3_bucket.integrated_data_gtfs_rt_bucket.arn}/*"
      ]
      }, {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn,
      ]
      }, {
      Action = [
        "cloudwatch:PutMetricData",
      ],
      Effect   = "Allow",
      Resource = "*"
  }]

  env_vars = {
    STAGE         = var.environment
    BUCKET_NAME   = aws_s3_bucket.integrated_data_gtfs_rt_bucket.bucket
    DB_HOST       = var.db_reader_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

resource "aws_lambda_function_url" "gtfs_rt_download_url" {
  count = var.environment == "local" ? 1 : 0

  function_name      = module.integrated_data_gtfs_rt_downloader_function.function_name
  authorization_type = "NONE"
}

# resource "aws_ecs_cluster" "gtfs_rt_ecs_cluster" {
#   count = var.environment != "local" ? 1 : 0

#   name = "integrated-data-gtfs-rt-ecs-cluster-${var.environment}"

#   setting {
#     name  = "containerInsights"
#     value = "enabled"
#   }
# }

resource "aws_iam_policy" "bods_avl_processor_ecs_execution_policy" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-bods-avl-processor-ecs-execution-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : "logs:CreateLogGroup",
        "Resource" : [
          "arn:aws:logs:eu-west-2:${data.aws_caller_identity.current.account_id}:log-group:/ecs/bods-avl-processor-${var.environment}:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role" "bods_avl_processor_ecs_execution_role" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-bods-avl-processor-ecs-execution-role-${var.environment}"

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

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy", aws_iam_policy.bods_avl_processor_ecs_execution_policy[0].arn]
}

resource "aws_iam_policy" "bods_avl_processor_ecs_task_policy" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-bods-avl-processor-ecs-task-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : "s3:PutObject",
        "Resource" : [
          "${aws_s3_bucket.integrated_data_gtfs_rt_bucket.arn}/*"
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

resource "aws_iam_role" "bods_avl_processor_ecs_task_role" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-bods-avl-processor-ecs-task-role-${var.environment}"

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

  managed_policy_arns = [aws_iam_policy.bods_avl_processor_ecs_task_policy[0].arn]
}

resource "aws_ecs_task_definition" "bods_avl_processor_task_definition" {
  count = var.environment != "local" ? 1 : 0

  family                   = var.environment == "prod-temp" ? "integrated-data-bods-avl-processor-temp" : "integrated-data-bods-avl-processor"
  cpu                      = var.bods_avl_processor_cpu
  memory                   = var.bods_avl_processor_memory
  requires_compatibilities = ["FARGATE"]
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
  network_mode = "awsvpc"

  task_role_arn      = aws_iam_role.bods_avl_processor_ecs_task_role[0].arn
  execution_role_arn = aws_iam_role.bods_avl_processor_ecs_execution_role[0].arn

  container_definitions = jsonencode([
    {
      "name" : "bods-avl-processor",
      "image" : var.bods_avl_processor_image_url,
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
          "value" : aws_s3_bucket.integrated_data_gtfs_rt_bucket.bucket
        },
        {
          "name" : "PROCESSOR_FREQUENCY_IN_SECONDS",
          "value" : tostring(var.bods_avl_processor_frequency)
        },
        {
          "name" : "CLEARDOWN_FREQUENCY_IN_SECONDS",
          "value" : tostring(var.bods_avl_cleardown_frequency)
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
          "awslogs-group" : "/ecs/bods-avl-processor-${var.environment}",
          "awslogs-region" : "eu-west-2",
          "awslogs-stream-prefix" : "ecs"
        },
        "secretOptions" : []
      },
      "systemControls" : []
    }
  ])
}

resource "aws_security_group" "bods_avl_processor_sg" {
  count = var.environment != "local" ? 1 : 0

  name   = "integrated-data-bods-avl-processor-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "bods_avl_processor_sg_allow_all_egress_ipv4" {
  count = var.environment != "local" ? 1 : 0

  security_group_id = aws_security_group.bods_avl_processor_sg[0].id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "bods_avl_processor_sg_allow_all_egress_ipv6" {
  count = var.environment != "local" ? 1 : 0

  security_group_id = aws_security_group.bods_avl_processor_sg[0].id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "db_sg_allow_lambda_ingress" {
  count = var.environment != "local" ? 1 : 0

  security_group_id            = var.db_sg_id
  referenced_security_group_id = aws_security_group.bods_avl_processor_sg[0].id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

resource "aws_ecs_service" "bods_avl_processor_service" {
  count = var.environment != "local" ? 1 : 0

  name            = "integrated-data-bods-avl-processor-service-${var.environment}"
  task_definition = aws_ecs_task_definition.bods_avl_processor_task_definition[0].arn
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
    security_groups = [aws_security_group.bods_avl_processor_sg[0].id]
  }

  depends_on = [aws_iam_policy.bods_avl_processor_ecs_task_policy[0]]

  lifecycle {
    ignore_changes = [task_definition]
  }
}
