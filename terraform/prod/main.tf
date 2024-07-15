terraform {
  required_version = ">= 1.6.6"

  backend "s3" {
    bucket = "integrated-data-tfstate-prod"
    key    = "terraform.tfstate"
    region = "eu-west-2"

    dynamodb_table = "integrated-data-state-lock-prod"
    encrypt        = true
  }

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

module "external_data_archive" {
  source = "../modules/external-data-archive"

  environment = local.env
}

module "integrated_data_monitoring" {
  source = "../modules/monitoring"

  environment     = local.env
  email_addresses = local.secrets["email_addresses_for_alarms"]
}

module "integrated_data_vpc" {
  source = "../modules/networking/vpc"

  environment                = local.env
  region                     = data.aws_region.current.name
  vpc_cidr                   = "10.100.0.0/16"
  db_subnet_cidr_blocks      = ["10.100.0.0/24", "10.100.1.0/24", "10.100.2.0/24"]
  private_subnet_cidr_blocks = ["10.100.10.0/24", "10.100.11.0/24", "10.100.12.0/24"]
  public_subnet_cidr_blocks  = ["10.100.20.0/24", "10.100.21.0/24", "10.100.22.0/24"]
}

module "integrated_data_route53" {
  source = "../modules/networking/route-53"

  environment = local.env
  vpc_id      = module.integrated_data_vpc.vpc_id
  root_domain = local.secrets["root_domain"]
}

module "integrated_data_acm" {
  source = "../modules/networking/acm"

  hosted_zone_id = module.integrated_data_route53.public_hosted_zone_id
  domain_name    = module.integrated_data_route53.public_hosted_zone_name
}

module "integrated_data_aurora_db" {
  source = "../modules/database/aurora-db"

  environment              = local.env
  db_subnet_ids            = module.integrated_data_vpc.db_subnet_ids
  vpc_id                   = module.integrated_data_vpc.vpc_id
  private_hosted_zone_id   = module.integrated_data_route53.private_hosted_zone_id
  private_hosted_zone_name = module.integrated_data_route53.private_hosted_zone_name
  multi_az                 = false
  instance_class           = "db.r6g.large"
}

module "integrated_data_db_monitoring" {
  source = "../modules/database/monitoring"

  environment     = local.env
  db_cluster_id   = module.integrated_data_aurora_db.db_cluster_id
  alarm_topic_arn = module.integrated_data_monitoring.alarm_topic_arn
  ok_topic_arn    = module.integrated_data_monitoring.ok_topic_arn
}

module "integrated_data_bastion_host" {
  source = "../modules/database/bastion-host"

  environment        = local.env
  db_sg_id           = module.integrated_data_aurora_db.db_sg_id
  private_subnet_ids = module.integrated_data_vpc.private_subnet_ids
  vpc_id             = module.integrated_data_vpc.vpc_id
  vpc_cidr           = module.integrated_data_vpc.vpc_cidr
}

module "integrated_data_db_migrator" {
  source = "../modules/database/db-migrator"

  environment        = local.env
  vpc_id             = module.integrated_data_vpc.vpc_id
  private_subnet_ids = module.integrated_data_vpc.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db.db_sg_id
  db_host            = module.integrated_data_aurora_db.db_host
}

module "integrated_data_avl_subscription_table" {
  source = "../modules/database/dynamo"

  environment = local.env
}

module "integrated_data_avl_pipeline" {
  source = "../modules/data-pipelines/avl-pipeline"

  environment                                 = local.env
  vpc_id                                      = module.integrated_data_vpc.vpc_id
  private_subnet_ids                          = module.integrated_data_vpc.private_subnet_ids
  db_secret_arn                               = module.integrated_data_aurora_db.db_secret_arn
  db_sg_id                                    = module.integrated_data_aurora_db.db_sg_id
  db_host                                     = module.integrated_data_aurora_db.db_host
  db_reader_host                              = module.integrated_data_aurora_db.db_reader_host
  alarm_topic_arn                             = module.integrated_data_monitoring.alarm_topic_arn
  ok_topic_arn                                = module.integrated_data_monitoring.ok_topic_arn
  tfl_api_keys                                = local.secrets["tfl_api_keys"]
  tfl_location_retriever_invoke_every_seconds = 60
  avl_subscription_table_name                 = module.integrated_data_avl_subscription_table.table_name
  aws_account_id                              = data.aws_caller_identity.current.account_id
  aws_region                                  = data.aws_region.current.name
  siri_vm_generator_image_url                 = local.secrets["siri_vm_generator_image_url"]
  siri_vm_generator_cpu                       = 1024
  siri_vm_generator_memory                    = 2048
  siri_vm_generator_frequency                 = 30
  avl_cleardown_frequency                     = 60
}

module "integrated_data_avl_data_producer_api" {
  source                      = "../modules/avl-producer-api"
  avl_raw_siri_bucket_name    = module.integrated_data_avl_pipeline.avl_raw_siri_bucket_name
  avl_subscription_table_name = module.integrated_data_avl_subscription_table.table_name
  aws_account_id              = data.aws_caller_identity.current.account_id
  aws_region                  = data.aws_region.current.name
  environment                 = local.env
  sg_id                       = module.integrated_data_vpc.default_sg_id
  acm_certificate_arn         = module.integrated_data_acm.acm_certificate_arn
  hosted_zone_id              = module.integrated_data_route53.public_hosted_zone_id
  domain                      = module.integrated_data_route53.public_hosted_zone_name
  subnet_ids                  = module.integrated_data_vpc.private_subnet_ids
  avl_producer_api_key        = local.secrets["avl_producer_api_key"]
}

# VPN

module "stagecoach_vpn" {
  source = "../modules/networking/site-to-site-vpn"

  environment            = local.env
  vpn_name               = "stagecoach"
  vpc_id                 = module.integrated_data_vpc.vpc_id
  subnet_cidr_blocks     = ["10.100.100.0/24", "10.100.101.0/24", "10.100.102.0/24"]
  nat_gateway_id         = module.integrated_data_vpc.nat_gateway_id
  customer_gateway_ip    = local.secrets["stagecoach_customer_gateway_ip"]
  destination_cidr_block = local.secrets["stagecoach_destination_cidr_block"]
}

# Internal AVL Ingestion

module "internal_avl_ingestion" {
  source = "../modules/data-pipelines/internal-avl-ingestion"

  environment                 = local.env
  vpc_id                      = module.integrated_data_vpc.vpc_id
  lb_subnet_ids               = module.stagecoach_vpn.subnet_ids
  external_ip_range           = local.secrets["stagecoach_destination_cidr_block"]
  data_endpoint_function_name = module.integrated_data_avl_data_producer_api.avl_data_endpoint_function_name
}

locals {
  env     = "prod"
  secrets = jsondecode(data.sops_file.secrets.raw)
}
