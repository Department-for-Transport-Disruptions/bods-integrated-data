terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

module "avl_validate" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-avl-validate"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-validate.zip"
  handler       = "index.handler"
  memory        = 128
  runtime       = "nodejs20.x"
  timeout       = 30

  permissions = [
    {
      Action = [
        "secretsmanager:GetSecretValue",
      ],
      Effect = "Allow",
      Resource = [
        var.avl_producer_api_key_arn
      ]
    }
  ]

  env_vars = {
    STAGE                    = var.environment
    AVL_PRODUCER_API_KEY_ARN = var.avl_producer_api_key_arn
  }
}
