terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

module "integrated_data_bods_avl_data_endpoint_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-bods-avl-data-endpoint"
  zip_path      = "${path.module}/../../../../src/functions/dist/avl-data-endpoint.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory        = 1024

  env_vars = {
    BUCKET_NAME = var.bucket_name
    STAGE       = var.environment
  }

  permissions = [
    {
      Action = [
        "s3:PutObject"
      ],
      Effect   = "Allow",
      Resource = [
        "arn:aws:s3:::${var.bucket_name}/*"
      ]
    }
  ]

}

output "lambda_arn" {
  description = "Lambda ARN"
  value       = module.integrated_data_bods_avl_data_endpoint_function.lambda_arn
}

output "function_name" {
  description = "Lambda function name"
  value       = module.integrated_data_bods_avl_data_endpoint_function.function_name
}
