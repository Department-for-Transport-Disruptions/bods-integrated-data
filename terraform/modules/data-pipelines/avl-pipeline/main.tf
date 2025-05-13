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

module "integrated_data_avl_s3_sqs" {
  source = "../../shared/s3-sqs"

  bucket_name                = "integrated-data-avl-raw-siri-vm-${var.environment}"
  sqs_name                   = "integrated-data-avl-queue-${var.environment}"
  dlq_name                   = "integrated-data-avl-dlq-${var.environment}"
  alarm_topic_arn            = var.alarm_topic_arn
  ok_topic_arn               = var.ok_topic_arn
  visibility_timeout_seconds = 60
}

module "integrated_data_avl_processor_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-processor"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-processor.zip"
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
    },
    {
      Action = ["dynamodb:GetItem"],
      Effect = "Allow",
      Resource = [
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_subscription_table_name}",
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.gtfs_trip_maps_table_name}",
      ]
    },
    {
      Action   = ["dynamodb:BatchWriteItem"],
      Effect   = "Allow",
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.avl_validation_error_table_name}"
    }
  ]

  env_vars = {
    STAGE                           = var.environment
    DB_HOST                         = var.db_host
    DB_PORT                         = var.db_port
    DB_SECRET_ARN                   = var.db_secret_arn
    DB_NAME                         = var.db_name
    AVL_SUBSCRIPTION_TABLE_NAME     = var.avl_subscription_table_name
    AVL_VALIDATION_ERROR_TABLE_NAME = var.avl_validation_error_table_name
    GTFS_TRIP_MAPS_TABLE_NAME       = var.gtfs_trip_maps_table_name
    ENABLE_CANCELLATIONS            = var.enable_cancellations
  }
}

resource "aws_lambda_event_source_mapping" "integrated_data_avl_processor_sqs_trigger" {
  event_source_arn = module.integrated_data_avl_s3_sqs.sqs_arn
  function_name    = module.integrated_data_avl_processor_function.lambda_arn
}

module "integrated_data_avl_tfl_line_id_retriever_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-tfl-line-id-retriever"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-tfl-line-id-retriever.zip"
  handler         = "index.handler"
  memory          = 512
  runtime         = "nodejs20.x"
  timeout         = 30
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id
}

resource "aws_secretsmanager_secret" "tfl_api_keys_secret" {
  name = "tfl_api_keys"
}

resource "aws_secretsmanager_secret_version" "tfl_api_keys_secret_version" {
  secret_id     = aws_secretsmanager_secret.tfl_api_keys_secret.id
  secret_string = jsonencode(var.tfl_api_keys)
}

module "integrated_data_avl_tfl_location_retriever_function" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "integrated-data-avl-tfl-location-retriever"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-tfl-location-retriever.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 30
  memory          = 512
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.db_secret_arn,
        aws_secretsmanager_secret.tfl_api_keys_secret.arn
      ]
    },
    {
      Action = ["dynamodb:GetItem"],
      Effect = "Allow",
      Resource = [
        "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/${var.gtfs_trip_maps_table_name}"
      ]
    },
  ]

  env_vars = {
    STAGE                     = var.environment
    DB_HOST                   = var.db_host
    DB_PORT                   = var.db_port
    DB_SECRET_ARN             = var.db_secret_arn
    DB_NAME                   = var.db_name
    TFL_API_ARN               = aws_secretsmanager_secret.tfl_api_keys_secret.arn
    GTFS_TRIP_MAPS_TABLE_NAME = var.gtfs_trip_maps_table_name
    TZ                        = "Europe/London"
  }
}

module "avl_tfl_location_retriever_sfn" {
  count                               = var.environment == "local" ? 0 : 1
  step_function_name                  = "integrated-data-avl-tfl-location-retriever"
  source                              = "./tfl-location-retriever-sfn"
  environment                         = var.environment
  invoke_every_seconds                = var.tfl_location_retriever_invoke_every_seconds
  depends_on                          = [module.integrated_data_avl_tfl_location_retriever_function, module.integrated_data_avl_tfl_line_id_retriever_function]
  aws_account_id                      = var.aws_account_id
  aws_region                          = var.aws_region
  tfl_line_id_retriever_function_arn  = module.integrated_data_avl_tfl_line_id_retriever_function.function_arn
  tfl_location_retriever_function_arn = module.integrated_data_avl_tfl_location_retriever_function.function_arn
}

resource "aws_s3_bucket" "integrated_data_avl_siri_vm_bucket" {
  bucket = "integrated-data-avl-generated-siri-vm-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "integrated_data_avl_siri_vm_block_public" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "integrated_data_avl_siri_vm_bucket_versioning" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

data "aws_iam_policy_document" "integrated_data_avl_bucket_allow_abods_policy" {
  statement {
    principals {
      type        = "AWS"
      identifiers = var.abods_account_ids
    }

    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
    ]

    resources = [
      "${aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn}/SIRI-VM.xml",
    ]
  }
}

resource "aws_s3_bucket_policy" "integrated_data_avl_siri_vm_bucket_policy" {
  bucket = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.id
  policy = data.aws_iam_policy_document.integrated_data_avl_bucket_allow_abods_policy.json
}

resource "aws_sns_topic" "integrated_data_avl_sirivm_sns_topic" {
  name                        = "integrated-data-siri-vm-topic-${var.environment}.fifo"
  fifo_topic                  = true
  content_based_deduplication = true
}

data "aws_iam_policy_document" "integrated_data_avl_sirivm_sns_policy" {
  statement {
    sid = "AllowABODSSubscribe"
    principals {
      type = "AWS"
      identifiers = [
        for id in var.abods_account_ids :
        "arn:aws:iam::${id}:root"
      ]
    }

    effect = "Allow"
    actions = [
      "sns:Subscribe",
      "sns:ListSubscriptionsByTopic"
    ]
    resources = [aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn]
  }
}

resource "aws_sns_topic_policy" "integrated_data_avl_sirivm_sns_topic_policy" {
  arn    = aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn
  policy = data.aws_iam_policy_document.integrated_data_avl_sirivm_sns_policy.json
}

resource "aws_iam_policy" "siri_vm_generator_ecs_execution_policy" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-vm-generator-ecs-execution-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : "logs:CreateLogGroup",
        "Resource" : [
          "arn:aws:logs:eu-west-2:${data.aws_caller_identity.current.account_id}:log-group:/ecs/siri-vm-generator-${var.environment}:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role" "siri_vm_generator_ecs_execution_role" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-vm-generator-ecs-execution-role-${var.environment}"

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
    aws_iam_policy.siri_vm_generator_ecs_execution_policy[0].arn
  ]
}

resource "aws_iam_policy" "siri_vm_generator_ecs_task_policy" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-vm-generator-ecs-task-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        "Effect" : "Allow",
        "Action" : "s3:PutObject",
        "Resource" : [
          "${aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn}/*",
          "${var.gtfs_rt_bucket_arn}/*"
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
      },
      {
        "Effect" : "Allow",
        "Action" : "sns:Publish",
        "Resource" : "${aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn}"
      }
    ]
  })
}

resource "aws_iam_role" "siri_vm_generator_ecs_task_role" {
  count = var.environment != "local" ? 1 : 0

  name = "integrated-data-siri-vm-generator-ecs-task-role-${var.environment}"

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

  managed_policy_arns = [aws_iam_policy.siri_vm_generator_ecs_task_policy[0].arn]
}

resource "aws_security_group" "siri_vm_generator_sg" {
  count = var.environment != "local" ? 1 : 0

  name   = "integrated-data-siri-vm-generator-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_egress_rule" "siri_vm_generator_sg_allow_all_egress_ipv4" {
  count = var.environment != "local" ? 1 : 0

  security_group_id = aws_security_group.siri_vm_generator_sg[0].id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "siri_vm_generator_sg_allow_all_egress_ipv6" {
  count = var.environment != "local" ? 1 : 0

  security_group_id = aws_security_group.siri_vm_generator_sg[0].id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "db_sg_allow_lambda_ingress" {
  count = var.environment != "local" ? 1 : 0

  security_group_id            = var.db_sg_id
  referenced_security_group_id = aws_security_group.siri_vm_generator_sg[0].id

  from_port = 5432
  to_port   = 5432

  ip_protocol = "tcp"
}

resource "aws_ecs_task_definition" "siri_vm_generator_task_definition" {
  count = var.environment != "local" ? 1 : 0

  family                   = "integrated-data-siri-vm-generator"
  cpu                      = var.siri_vm_generator_cpu
  memory                   = var.siri_vm_generator_memory
  requires_compatibilities = ["FARGATE"]
  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }
  network_mode = "awsvpc"

  task_role_arn      = aws_iam_role.siri_vm_generator_ecs_task_role[0].arn
  execution_role_arn = aws_iam_role.siri_vm_generator_ecs_execution_role[0].arn

  container_definitions = jsonencode([
    {
      "name" : "siri-vm-generator",
      "image" : var.siri_vm_generator_image_url,
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
          "name" : "GTFS_RT_BUCKET_NAME",
          "value" : var.gtfs_rt_bucket_name
        },
        {
          "name" : "SIRI_VM_BUCKET_NAME",
          "value" : aws_s3_bucket.integrated_data_avl_siri_vm_bucket.bucket
        },
        {
          "name" : "SIRI_VM_SNS_TOPIC_ARN",
          "value" : aws_sns_topic.integrated_data_avl_sirivm_sns_topic.arn
        },
        {
          "name" : "SAVE_JSON",
          "value" : tostring(var.save_json)
        },
        {
          "name" : "PROCESSOR_FREQUENCY_IN_SECONDS",
          "value" : tostring(var.siri_vm_generator_frequency)
        },
        {
          "name" : "CLEARDOWN_FREQUENCY_IN_SECONDS",
          "value" : tostring(var.avl_cleardown_frequency)
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
          "awslogs-group" : "/ecs/siri-vm-generator-${var.environment}",
          "awslogs-region" : "eu-west-2",
          "awslogs-stream-prefix" : "ecs"
        },
        "secretOptions" : []
      },
      "systemControls" : []
    }
  ])
}

resource "aws_ecs_service" "siri_vm_generator_service" {
  count = var.environment != "local" ? 1 : 0

  name            = "integrated-data-siri-vm-generator-service-${var.environment}"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.siri_vm_generator_task_definition[0].arn
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
    security_groups = [aws_security_group.siri_vm_generator_sg[0].id]
  }

  depends_on = [aws_iam_policy.siri_vm_generator_ecs_task_policy[0]]

  lifecycle {
    ignore_changes = [task_definition]
  }
}

module "siri_vm_downloader" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "avl-siri-vm-downloader"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-siri-vm-downloader.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
  memory          = 2048
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
        "${aws_s3_bucket.integrated_data_avl_siri_vm_bucket.arn}/*"
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

  env_vars = {
    STAGE                = var.environment
    BUCKET_NAME          = aws_s3_bucket.integrated_data_avl_siri_vm_bucket.bucket
    DB_HOST              = var.db_reader_host
    DB_PORT              = var.db_port
    DB_SECRET_ARN        = var.db_secret_arn
    DB_NAME              = var.db_name
    ENABLE_CANCELLATIONS = var.enable_cancellations
  }
}

module "siri_vm_stats" {
  source = "../../shared/lambda-function"

  environment     = var.environment
  function_name   = "avl-siri-vm-stats"
  zip_path        = "${path.module}/../../../../src/functions/dist/avl-siri-vm-stats.zip"
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300
  memory          = 2048
  needs_db_access = var.environment != "local"
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids
  database_sg_id  = var.db_sg_id

  permissions = [
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

  env_vars = {
    STAGE         = var.environment
    DB_HOST       = var.db_reader_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
}

module "integrated_data_avl_data_consumer_subscriptions" {
  source                          = "../../avl-consumer-subscriptions"
  environment                     = var.environment
  aws_account_id                  = var.aws_account_id
  aws_region                      = var.aws_region
  vpc_id                          = var.vpc_id
  subnet_ids                      = var.private_subnet_ids
  db_sg_id                        = var.db_sg_id
  db_host                         = var.db_host
  db_port                         = var.db_port
  db_secret_arn                   = var.db_secret_arn
  db_name                         = var.db_name
  avl_producer_subscription_table = var.avl_subscription_table_name
  alarm_topic_arn                 = var.alarm_topic_arn
  ok_topic_arn                    = var.ok_topic_arn
}
