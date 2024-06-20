terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
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

  env_vars = {
    STAGE = var.environment
  }
}
