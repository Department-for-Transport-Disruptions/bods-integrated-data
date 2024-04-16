terraform {
  required_version = ">= 1.6.6"

  backend "s3" {
    bucket = "integrated-data-tfstate-dev"
    key    = "terraform.tfstate"
    region = "eu-west-2"

    dynamodb_table = "integrated-data-state-lock-dev"
    encrypt        = true
  }

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

module "integrated_data_monitoring_dev" {
  source = "../modules/monitoring"

  environment     = local.env
  email_addresses = local.secrets["email_addresses_for_alarms"]
}

module "integrated_data_vpc_dev" {
  source = "../modules/networking/vpc"

  environment = local.env
  region      = data.aws_region.current.name
}

module "integrated_data_route53" {
  source = "../modules/networking/route-53"

  vpc_id = module.integrated_data_vpc_dev.vpc_id
}

module "integrated_data_aurora_db_dev" {
  source = "../modules/database/aurora-db"

  environment              = local.env
  db_subnet_ids            = module.integrated_data_vpc_dev.db_subnet_ids
  vpc_id                   = module.integrated_data_vpc_dev.vpc_id
  private_hosted_zone_id   = module.integrated_data_route53.private_hosted_zone_id
  private_hosted_zone_name = module.integrated_data_route53.private_hosted_zone_name
  min_db_capacity          = 0.5
  max_db_capacity          = 16
  enable_rds_proxy         = true
}

module "integrated_data_db_monitoring" {
  source = "../modules/database/monitoring"

  environment     = local.env
  db_cluster_id   = module.integrated_data_aurora_db_dev.db_cluster_id
  alarm_topic_arn = module.integrated_data_monitoring_dev.alarm_topic_arn
  ok_topic_arn    = module.integrated_data_monitoring_dev.ok_topic_arn
}

module "integrated_data_bastion_host" {
  source = "../modules/database/bastion-host"

  environment              = local.env
  db_sg_id                 = module.integrated_data_aurora_db_dev.db_sg_id
  private_subnet_ids       = module.integrated_data_vpc_dev.private_subnet_ids
  vpc_id                   = module.integrated_data_vpc_dev.vpc_id
  vpc_cidr                 = module.integrated_data_vpc_dev.vpc_cidr
  interface_endpoint_sg_id = module.integrated_data_vpc_dev.interface_endpoint_sg_id
}

module "integrated_data_db_migrator" {
  source = "../modules/database/db-migrator"

  environment        = local.env
  vpc_id             = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db_dev.db_sg_id
  db_host            = module.integrated_data_aurora_db_dev.db_host
}

module "integrated_data_naptan_pipeline" {
  source = "../modules/data-pipelines/naptan-pipeline"

  environment        = local.env
  vpc_id             = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db_dev.db_sg_id
  db_host            = module.integrated_data_aurora_db_dev.db_host
}

module "integrated_data_nptg_pipeline" {
  source = "../modules/data-pipelines/nptg-pipeline"

  environment        = local.env
}

module "integrated_data_txc_pipeline" {
  source = "../modules/data-pipelines/txc-pipeline"

  environment            = local.env
  vpc_id                 = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids     = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn          = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id               = module.integrated_data_aurora_db_dev.db_sg_id
  db_host                = module.integrated_data_aurora_db_dev.db_host
  tnds_ftp_credentials   = local.secrets["tnds_ftp"]
  rds_output_bucket_name = module.integrated_data_aurora_db_dev.s3_output_bucket_name
  alarm_topic_arn        = module.integrated_data_monitoring_dev.alarm_topic_arn
  ok_topic_arn           = module.integrated_data_monitoring_dev.ok_topic_arn
}

module "integrated_data_gtfs_downloader" {
  source = "../modules/gtfs-downloader"

  environment      = local.env
  gtfs_bucket_name = module.integrated_data_txc_pipeline.gtfs_timetables_bucket_name
}

module "integrated_data_gtfs_rt_pipeline" {
  source = "../modules/data-pipelines/gtfs-rt-pipeline"

  environment        = local.env
  vpc_id             = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db_dev.db_sg_id
  db_host            = module.integrated_data_aurora_db_dev.db_host
}

module "integrated_data_avl_pipeline" {
  source = "../modules/data-pipelines/avl-pipeline"

  environment        = local.env
  vpc_id             = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db_dev.db_sg_id
  db_host            = module.integrated_data_aurora_db_dev.db_host
  alarm_topic_arn    = module.integrated_data_monitoring_dev.alarm_topic_arn
  ok_topic_arn       = module.integrated_data_monitoring_dev.ok_topic_arn
}

module "integrated_data_avl_aggregator" {
  source = "../modules/data-pipelines/avl-aggregate-siri-vm"

  environment        = local.env
  vpc_id             = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db_dev.db_sg_id
  db_host            = module.integrated_data_aurora_db_dev.db_host
}

module "integrated_data_avl_subscription_table" {
  source = "../modules/database/dynamo"

  environment = local.env
}

module "integrated_data_avl_subscriber" {
  source = "../modules/avl-producer-api/avl-subscriber"

  environment                               = local.env
  avl_subscription_table_name               = module.integrated_data_avl_subscription_table.table_name
  avl_mock_data_producer_subscribe_endpoint = "${module.avl_mock_data_producer.endpoint}/subscribe"
  avl_data_endpoint                         = "${module.integrated_data_avl_producer_api_gateway.endpoint}/data"
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

module "integrated_data_avl_data_endpoint" {
  source = "../modules/avl-producer-api/avl-data-endpoint"

  environment                 = local.env
  bucket_name                 = module.integrated_data_avl_pipeline.bucket_name
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
}

module avl_mock_data_producer {
  source = "../modules/avl-producer-api/mock-data-producer"

  environment                 = local.env
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
  avl_consumer_data_endpoint  = "${module.integrated_data_avl_producer_api_gateway.endpoint}/data"
}

module "integrated_data_avl_producer_api_gateway" {
  source = "../modules/avl-producer-api/api-gateway"

  environment                     = local.env
  subscribe_lambda_name           = module.integrated_data_avl_subscriber.lambda_name
  subscribe_lambda_invoke_arn     = module.integrated_data_avl_subscriber.invoke_arn
  data_endpoint_lambda_name       = module.integrated_data_avl_data_endpoint.lambda_name
  data_endpoint_lambda_invoke_arn = module.integrated_data_avl_data_endpoint.invoke_arn
}

locals {
  env     = "dev"
  secrets = jsondecode(data.sops_file.secrets.raw)
}

module "integrated_data_noc_pipeline" {
  source = "../modules/data-pipelines/noc-pipeline"

  environment        = local.env
  vpc_id             = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db_dev.db_sg_id
  db_host            = module.integrated_data_aurora_db_dev.db_host
}
