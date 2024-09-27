terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_secretsmanager_secret" "cancellations_producer_api_key_secret" {
  name = "cancellations_producer_api_key"
}

resource "aws_secretsmanager_secret_version" "cancellations_producer_api_key_secret_version" {
  secret_id     = aws_secretsmanager_secret.cancellations_producer_api_key_secret.id
  secret_string = jsonencode(var.cancellations_producer_api_key)
}

module "integrated_data_cancellations_subscription_table" {
  source = "../../modules/shared/dynamo-table"

  environment = var.environment
  table_name  = "integrated-data-cancellations-subscription-table"
}

module "cancellations_subscriber" {
  source = "./cancellations-subscriber"

  environment                           = var.environment
  aws_account_id                        = var.aws_account_id
  aws_region                            = var.aws_region
  sg_id                                 = var.sg_id
  subnet_ids                            = var.subnet_ids
  cancellations_producer_api_key_arn    = aws_secretsmanager_secret.cancellations_producer_api_key_secret.arn
  cancellations_data_endpoint           = "https://www.test.com"
  cancellations_subscription_table_name = module.integrated_data_cancellations_subscription_table.table_name
  mock_data_producer_subscribe_endpoint = (var.environment == "local" ?
    var.mock_data_producer_subscribe_function_url :
  "${var.mock_data_producer_api_endpoint}/subscriptions")
}

module "cancellations_unsubscriber" {
  source = "./cancellations-unsubscriber"

  environment                           = var.environment
  aws_account_id                        = var.aws_account_id
  aws_region                            = var.aws_region
  sg_id                                 = var.sg_id
  subnet_ids                            = var.subnet_ids
  cancellations_producer_api_key_arn    = aws_secretsmanager_secret.cancellations_producer_api_key_secret.arn
  cancellations_subscription_table_name = module.integrated_data_cancellations_subscription_table.table_name
}

module "cancellations_producer_api_gateway" {
  count                         = var.environment == "local" ? 0 : 1
  source                        = "./api-gateway"
  environment                   = var.environment
  domain                        = var.domain
  acm_certificate_arn           = var.acm_certificate_arn
  hosted_zone_id                = var.hosted_zone_id
  subscribe_lambda_invoke_arn   = module.cancellations_subscriber.invoke_arn
  subscribe_lambda_name         = module.cancellations_subscriber.lambda_name
  unsubscribe_lambda_invoke_arn = module.cancellations_unsubscriber.invoke_arn
  unsubscribe_lambda_name       = module.cancellations_unsubscriber.lambda_name
}
