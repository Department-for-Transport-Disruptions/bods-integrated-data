terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

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
  }]

  env_vars = {
    STAGE         = var.environment
    BUCKET_NAME   = aws_s3_bucket.integrated_data_gtfs_rt_bucket.bucket
    DB_HOST       = var.db_host
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

resource "aws_ecs_cluster" "integrated_data_ecs_cluster" {
  name = "integrated-data-gtfs-rt-ecs-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "integrated_data_bods_avl_processor_task_definition" {
  family                   = "integrated-data-bods-avl-processor"
  cpu                      = var.bods_avl_processor_cpu
  memory                   = var.bods_avl_processor_memory
  requires_compatibilities = ["FARGATE"]
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
  network_mode = "awsvpc"

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
          "name" : "DB_PORT",
          "value" : var.db_port
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
          "value" : var.bods_avl_processor_frequency
        },
        {
          "name" : "CLEARDOWN_FREQUENCY_IN_SECONDS",
          "value" : var.bods_avl_cleardown_frequency
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

  volume {
    name      = "service-storage"
    host_path = "/ecs/service-storage"
  }

  placement_constraints {
    type       = "memberOf"
    expression = "attribute:ecs.availability-zone in [us-west-2a, us-west-2b]"
  }
}
