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

  environment               = local.env
  vpc_id                    = null
  private_subnet_ids        = null
  db_secret_arn             = "*"
  db_sg_id                  = null
  db_host                   = null
  tnds_ftp_credentials      = local.secrets["tnds_ftp"]
  rds_output_bucket_name    = "integrated-data-aurora-output-${local.env}"
  alarm_topic_arn           = ""
  ok_topic_arn              = ""
  bank_holidays_bucket_name = module.integrated_data_bank_holidays_pipeline.bank_holidays_bucket_name
  bank_holidays_bucket_arn  = module.integrated_data_bank_holidays_pipeline.bank_holidays_bucket_arn
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

module "integrated_data_avl_pipeline" {
  source = "../modules/data-pipelines/avl-pipeline"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
  alarm_topic_arn    = ""
  ok_topic_arn       = ""
}

module "integrated_data_avl_aggregator" {
  source = "../modules/data-pipelines/avl-aggregate-siri-vm"

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
  bucket_name                 = module.integrated_data_avl_pipeline.bucket_name
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

module "integrated_data_avl_unsubscriber" {
  source = "../modules/avl-producer-api/avl-unsubscriber"

  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
  environment                 = local.env
}

module "integrated_data_bank_holidays_pipeline" {
  source = "../modules/data-pipelines/bank-holidays-pipeline"

  environment = local.env
}

module "integrated_data_db_cleardown_function" {
  source = "../modules/db-cleardown"

  environment        = local.env
  vpc_id             = null
  private_subnet_ids = null
  db_secret_arn      = "*"
  db_sg_id           = null
  db_host            = null
}

module "integrated_data_timetables_sfn" {
  source = "../modules/timetables-sfn"

  environment                            = local.env
  bods_txc_retriever_function_arn        = module.integrated_data_txc_pipeline.bods_txc_retriever_function_arn
  tnds_txc_retriever_function_arn        = module.integrated_data_txc_pipeline.tnds_txc_retriever_function_arn
  txc_processor_function_arn             = module.integrated_data_txc_pipeline.txc_processor_function_arn
  unzipper_function_arn                  = module.integrated_data_txc_pipeline.unzipper_function_arn
  gtfs_timetables_generator_function_arn = module.integrated_data_txc_pipeline.gtfs_timetables_generator_function_arn
  naptan_retriever_function_arn          = module.integrated_data_naptan_pipeline.naptan_retriever_function_arn
  naptan_uploader_function_arn           = module.integrated_data_naptan_pipeline.naptan_uploader_function_arn
  noc_retriever_function_arn             = module.integrated_data_noc_pipeline.noc_retriever_function_arn
  noc_processor_function_arn             = module.integrated_data_noc_pipeline.noc_processor_function_arn
  nptg_retriever_function_arn            = module.integrated_data_nptg_pipeline.nptg_retriever_function_arn
  nptg_uploader_function_arn             = module.integrated_data_nptg_pipeline.nptg_uploader_function_arn
  bank_holidays_retriever_function_arn   = module.integrated_data_bank_holidays_pipeline.bank_holidays_retriever_function_arn
  db_cleardown_function_arn              = module.integrated_data_db_cleardown_function.db_cleardown_function_arn
  table_renamer_function_arn             = module.integrated_data_table_renamer.table_renamer_function_arn
  tnds_txc_zipped_bucket_name            = module.integrated_data_txc_pipeline.tnds_txc_zipped_bucket_name
  bods_txc_zipped_bucket_name            = module.integrated_data_txc_pipeline.bods_txc_zipped_bucket_name
  bods_txc_bucket_name                   = module.integrated_data_txc_pipeline.bods_txc_bucket_name
  tnds_txc_bucket_name                   = module.integrated_data_txc_pipeline.tnds_txc_bucket_name
  noc_bucket_name                        = module.integrated_data_noc_pipeline.noc_bucket_name
  naptan_bucket_name                     = module.integrated_data_naptan_pipeline.naptan_bucket_name
  nptg_bucket_name                       = module.integrated_data_nptg_pipeline.nptg_bucket_name
}
