terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_secretsmanager_secret" "avl_producer_api_key_secret" {
  name = "avl_producer_api_key"
}

resource "aws_secretsmanager_secret_version" "avl_producer_api_key_secret_version" {
  secret_id     = aws_secretsmanager_secret.avl_producer_api_key_secret.id
  secret_string = jsonencode(var.avl_producer_api_key)
}

module "avl_subscriptions" {
  source = "./avl-subscriptions"

  environment              = var.environment
  aws_account_id           = var.aws_account_id
  aws_region               = var.aws_region
  table_name               = var.avl_subscription_table_name
  avl_producer_api_key_arn = aws_secretsmanager_secret.avl_producer_api_key_secret.arn
}

module "avl_data_endpoint" {
  source = "./avl-data-endpoint"

  environment                 = var.environment
  bucket_name                 = var.avl_raw_siri_bucket_name
  avl_subscription_table_name = var.avl_subscription_table_name
  aws_account_id              = var.aws_account_id
  aws_region                  = var.aws_region
  sg_id                       = var.sg_id
  subnet_ids                  = var.subnet_ids
}

resource "aws_lambda_function_url" "avl_data_endpoint_function_url" {
  count              = var.environment == "local" ? 1 : 0
  function_name      = module.avl_data_endpoint.function_name
  authorization_type = "NONE"
}

module "avl_subscriber" {
  source = "./avl-subscriber"

  environment                 = var.environment
  avl_subscription_table_name = var.avl_subscription_table_name
  avl_mock_data_producer_subscribe_endpoint = (var.environment == "local" ?
    var.mock_data_producer_subscribe_function_url :
  "${var.mock_data_producer_api_endpoint}/subscriptions")
  avl_data_endpoint = (var.environment == "local" ? "https://www.mock-data-endpoint.com/subscriptions" :
  "https://${module.avl_producer_api_gateway[0].endpoint}/subscriptions")
  avl_internal_data_endpoint = var.internal_data_endpoint
  aws_account_id             = var.aws_account_id
  aws_region                 = var.aws_region
  sg_id                      = var.sg_id
  subnet_ids                 = var.subnet_ids
  avl_producer_api_key_arn   = aws_secretsmanager_secret.avl_producer_api_key_secret.arn
}

resource "aws_lambda_function_url" "avl_subscribe_endpoint_function_url" {
  count              = var.environment == "local" ? 1 : 0
  function_name      = module.avl_subscriber.lambda_name
  authorization_type = "NONE"
}

module "avl_unsubscriber" {
  source = "./avl-unsubscriber"

  avl_subscription_table_name = var.avl_subscription_table_name
  aws_account_id              = var.aws_account_id
  aws_region                  = var.aws_region
  environment                 = var.environment
  sg_id                       = var.sg_id
  subnet_ids                  = var.subnet_ids
  avl_producer_api_key_arn    = aws_secretsmanager_secret.avl_producer_api_key_secret.arn
}

module "avl_update_endpoint" {
  source = "./avl-update-endpoint"

  avl_subscription_table_name = var.avl_subscription_table_name
  avl_mock_data_producer_subscribe_endpoint = (var.environment == "local" ?
    var.mock_data_producer_subscribe_function_url :
  "${var.mock_data_producer_api_endpoint}/subscriptions")
  avl_data_endpoint = (var.environment == "local" ? "https://www.mock-data-endpoint.com/subscriptions" :
  "https://${module.avl_producer_api_gateway[0].endpoint}/subscriptions")
  avl_internal_data_endpoint = var.internal_data_endpoint
  aws_account_id             = var.aws_account_id
  aws_region                 = var.aws_region
  environment                = var.environment
  sg_id                      = var.sg_id
  subnet_ids                 = var.subnet_ids
  avl_producer_api_key_arn   = aws_secretsmanager_secret.avl_producer_api_key_secret.arn
}

module "avl_validate" {
  source = "./avl-validate"

  environment              = var.environment
  avl_producer_api_key_arn = aws_secretsmanager_secret.avl_producer_api_key_secret.arn
}

module "avl_datafeed_validator" {
  source                      = "./avl-datafeed-validator"
  avl_error_table_name        = var.avl_error_table_name
  avl_producer_api_key_arn    = aws_secretsmanager_secret.avl_producer_api_key_secret.arn
  aws_account_id              = var.aws_account_id
  aws_region                  = var.aws_region
  environment                 = var.environment
  avl_subscription_table_name = var.avl_subscription_table_name
}

module "avl_producer_api_gateway" {
  count                                = var.environment == "local" ? 0 : 1
  source                               = "./api-gateway"
  data_endpoint_lambda_invoke_arn      = module.avl_data_endpoint.invoke_arn
  data_endpoint_lambda_name            = module.avl_data_endpoint.function_name
  datafeed_validator_lambda_invoke_arn = module.avl_datafeed_validator.invoke_arn
  datafeed_validator_lambda_name       = module.avl_datafeed_validator.lambda_name
  environment                          = var.environment
  subscribe_lambda_invoke_arn          = module.avl_subscriber.invoke_arn
  subscribe_lambda_name                = module.avl_subscriber.lambda_name
  unsubscribe_lambda_invoke_arn        = module.avl_unsubscriber.invoke_arn
  unsubscribe_lambda_name              = module.avl_unsubscriber.lambda_name
  update_lambda_invoke_arn             = module.avl_update_endpoint.invoke_arn
  update_lambda_name                   = module.avl_update_endpoint.lambda_name
  subscriptions_lambda_invoke_arn      = module.avl_subscriptions.invoke_arn
  subscriptions_lambda_name            = module.avl_subscriptions.lambda_name
  validate_lambda_invoke_arn           = module.avl_validate.invoke_arn
  validate_lambda_name                 = module.avl_validate.lambda_name
  domain                               = var.domain
  acm_certificate_arn                  = var.acm_certificate_arn
  hosted_zone_id                       = var.hosted_zone_id
}

module "avl_feed_validator" {
  source                      = "./avl-feed-validator"
  avl_subscription_table_name = var.avl_subscription_table_name
  aws_account_id              = var.aws_account_id
  aws_region                  = var.aws_region
  environment                 = var.environment
  avl_consumer_subscribe_endpoint = (var.environment == "local" ?
    aws_lambda_function_url.avl_subscribe_endpoint_function_url[0].function_url :
  "https://${module.avl_producer_api_gateway[0].endpoint}/subscriptions")
  avl_producer_api_key_arn = aws_secretsmanager_secret.avl_producer_api_key_secret.arn
  sg_id                    = var.sg_id
  subnet_ids               = var.subnet_ids
}

module "avl_feed_validator_sfn" {
  count = var.environment == "local" ? 0 : 1

  step_function_name   = "integrated-data-avl-feed-validator"
  source               = "../../modules/shared/lambda-trigger-sfn"
  environment          = var.environment
  function_arn         = module.avl_feed_validator.function_arn
  invoke_every_seconds = 30
  depends_on           = [module.avl_feed_validator]
}
