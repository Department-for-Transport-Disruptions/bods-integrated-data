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
  bank_holidays_bucket_name = module.integrated_data_bank_holidays_pipeline.bank_holidays_bucket_name
}

module "integrated_data_gtfs_downloader" {
  source = "../modules/gtfs-downloader"

  environment      = local.env
  gtfs_bucket_name = module.integrated_data_txc_pipeline.gtfs_timetables_bucket_name
}

module "integrated_data_gtfs_rt_pipeline" {
  source = "../modules/data-pipelines/gtfs-rt-pipeline"

  environment                  = local.env
  vpc_id                       = null
  private_subnet_ids           = null
  db_secret_arn                = "*"
  db_sg_id                     = ""
  db_host                      = null
  db_reader_host               = null
  bods_avl_processor_cpu       = 1024
  bods_avl_processor_memory    = 2048
  bods_avl_processor_image_url = "bods-avl-processor:latest"
  bods_avl_cleardown_frequency = 120
  bods_avl_processor_frequency = 240
}

module "integrated_data_avl_pipeline" {
  source = "../modules/data-pipelines/avl-pipeline"

  environment                                 = local.env
  vpc_id                                      = null
  private_subnet_ids                          = null
  db_secret_arn                               = "*"
  db_sg_id                                    = null
  db_host                                     = null
  alarm_topic_arn                             = ""
  ok_topic_arn                                = ""
  tfl_api_keys                                = local.secrets["tfl_api_keys"]
  tfl_location_retriever_invoke_every_seconds = 60
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

module "integrated_data_avl_subscription_table" {
  source = "../modules/database/dynamo"

  environment = local.env
}

module "integrated_data_avl_data_producer_api" {
  source                      = "../modules/avl-producer-api"
  avl_siri_bucket_name        = module.integrated_data_avl_pipeline.bucket_name
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
  environment                 = local.env
}

module "integrated_data_avl_siri_vm_downloader" {
  source = "../modules/avl-siri-vm-downloader"

  environment = local.env
  bucket_name = module.integrated_data_avl_aggregator.avl_siri_vm_bucket_name
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

module "integrated_data_fares_pipeline" {
  source = "../modules/data-pipelines/fares-pipeline"

  environment = local.env
}
