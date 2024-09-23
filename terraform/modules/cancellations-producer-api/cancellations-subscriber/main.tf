terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

module "cancellations_subscriber" {
  source = "../../shared/lambda-function"

  environment      = var.environment
  function_name    = "integrated-data-cancellations-subscriber"
  zip_path         = "${path.module}/../../../../src/functions/dist/cancellations-subscriber.zip"
  handler          = "index.handler"
  memory           = 1024
  runtime          = "nodejs20.x"
  timeout          = 120
  needs_vpc_access = true
  custom_sg_id     = var.sg_id
  subnet_ids       = var.subnet_ids
  retry_attempts   = 0

  permissions = [
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.cancellations_producer_api_key_arn
      ]
    }
  ]


  env_vars = {
    STAGE = var.environment
  }
}
