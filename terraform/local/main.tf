terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }

    sops = {
      source  = "carlpett/sops"
      version = "~> 1.0"
    }
  }
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

data "sops_file" "secrets" {
  source_file = "secrets.enc.json"
}

locals {
  env     = "local"
  secrets = jsondecode(data.sops_file.secrets.raw)
}

module "integrated_data_db_migrator" {
  source = "../modules/database/db-migrator"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
}

module "integrated_data_noc_pipeline" {
  source = "../modules/data-pipelines/noc-pipeline"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
}

module "integrated_data_table_renamer" {
  source = "../modules/table-renamer"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
}

module "integrated_data_naptan_pipeline" {
  source = "../modules/data-pipelines/naptan-pipeline"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
}

module "integrated_data_nptg_pipeline" {
  source = "../modules/data-pipelines/nptg-pipeline"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
}

module "integrated_data_txc_pipeline" {
  source = "../modules/data-pipelines/txc-pipeline"

  environment            = local.env
  vpc_id                 = null
  private_subnet_ids     = null
  db_secret_arn          = "*"
  db_sg_id               = null
  db_host                = null
  tnds_ftp_credentials   = local.secrets["tnds_ftp"]
  rds_output_bucket_name = "integrated-data-aurora-output-${local.env}"
  alarm_topic_arn        = ""
  ok_topic_arn           = ""
}

module "integrated_data_gtfs_downloader" {
  source = "../modules/gtfs-downloader"

  environment      = local.env
  gtfs_bucket_name = module.integrated_data_txc_pipeline.gtfs_timetables_bucket_name
}

module "integrated_data_gtfs_rt_pipeline" {
  source = "../modules/data-pipelines/gtfs-rt-pipeline"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
}

module "integrated_data_avl_data_endpoint" {
  source = "../modules/avl-producer-api/avl-data-endpoint"

  environment                 = local.env
  bucket_name                 = "integrated-data-siri-vm-local"
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
}

resource "aws_lambda_function_url" "integrated_data_mock_avl_producer_function_url" {
  function_name      = module.integrated_data_avl_data_endpoint.function_name
  authorization_type = "NONE"
}

module "integrated_data_avl_subscription_table" {
  source = "../modules/database/dynamo"

  environment = local.env
}

module "avl_mock_data_producer" {
  source = "../modules/avl-producer-api/mock-data-producer"

  environment                 = local.env
  avl_consumer_data_endpoint  = aws_lambda_function_url.integrated_data_mock_avl_producer_function_url.function_url
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
}

module "integrated_data_avl_subscriber" {
  source = "../modules/avl-producer-api/avl-subscriber"

  environment                               = local.env
  avl_subscription_table_name               = module.integrated_data_avl_subscription_table.table_name
  avl_mock_data_producer_subscribe_endpoint = module.avl_mock_data_producer.function_url
  avl_data_endpoint                         = "https://www.mock-data-endpoint.com/data"
  aws_account_id                            = data.aws_caller_identity.current.account_id
  aws_region                                = data.aws_region.current.name
}

module "avl-unsubscriber" {
  source = "../modules/avl-producer-api/avl-unsubscriber"

  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
  environment                 = local.env
}
