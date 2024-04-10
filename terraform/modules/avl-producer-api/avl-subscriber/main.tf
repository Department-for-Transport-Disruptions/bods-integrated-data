terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "avl_subscriber" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "avl-subscriber"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-subscriber.zip"
  handler       = "index.handler"
  memory        = 1024
  runtime       = "nodejs20.x"
  timeout       = 120
}
