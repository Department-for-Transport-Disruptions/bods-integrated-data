terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
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
  db_sg_id                     = null
  db_host                      = null
  db_reader_host               = null
  cluster_id                   = ""
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
  db_reader_host                              = null
  alarm_topic_arn                             = ""
  ok_topic_arn                                = ""
  tfl_api_keys                                = local.secrets["tfl_api_keys"]
  tfl_location_retriever_invoke_every_seconds = 60
  avl_subscription_table_name                 = module.integrated_data_avl_subscription_table.table_name
  aws_account_id                              = data.aws_caller_identity.current.account_id
  aws_region                                  = data.aws_region.current.name
  cluster_id                                  = ""
  siri_vm_generator_cpu                       = 1024
  siri_vm_generator_memory                    = 2048
  siri_vm_generator_image_url                 = "siri-vm-generator:latest"
  siri_vm_generator_frequency                 = 240
  avl_cleardown_frequency                     = 120
  siri_vm_downloader_image_url                = "siri-vm-downloader:latest"
  siri_vm_downloader_cpu                      = 1024
  siri_vm_downloader_memory                   = 2048
  siri_vm_downloader_desired_task_count       = 3
  siri_vm_downloader_nlb_target_group_arn     = module.integrated_data_internal_api.nlb_target_group_arn
  generated_siri_vm_bucket_name               = module.integrated_data_avl_pipeline.avl_generated_siri_bucket_name
  avl_consumer_api_key                        = local.secrets["avl_consumer_api_key"]
  nlb_sg_id                                   = module.integrated_data_internal_api.nlb_sg_id
  avl_validation_error_table_name             = module.integrated_data_avl_validation_error_table.table_name
}

module "integrated_data_avl_subscription_table" {
  source = "../modules/shared/dynamo-table"

  environment = local.env
  table_name  = "integrated-data-avl-subscription-table"
}

module "integrated_data_avl_validation_error_table" {
  source = "../modules/shared/dynamo-table"

  environment   = local.env
  table_name    = "integrated-data-avl-validation-error-table"
  ttl_attribute = "timeToExist"
}

module "integrated_data_avl_data_producer_api" {
  source                      = "../modules/avl-producer-api"
  avl_raw_siri_bucket_name    = module.integrated_data_avl_pipeline.avl_raw_siri_bucket_name
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
  environment                 = local.env
  sg_id                       = ""
  subnet_ids                  = []
  acm_certificate_arn         = ""
  hosted_zone_id              = ""
  domain                      = ""
  avl_producer_api_key        = local.secrets["avl_producer_api_key"]
  avl_error_table_name        = module.integrated_data_avl_validation_error_table.table_name
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

module "integrated_data_disruptions_pipeline" {
  source = "../modules/data-pipelines/disruptions-pipeline"

  environment = local.env
}
