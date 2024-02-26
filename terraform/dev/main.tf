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
  max_db_capacity          = 4
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

module "integrated_data_db_monitoring" {
  source = "../modules/database/monitoring"

  environment     = local.env
  db_cluster_id   = module.integrated_data_aurora_db_dev.db_cluster_id
  email_addresses = jsondecode(data.sops_file.secrets.raw)["email_addresses_for_alarms"]
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

module "avl_lambda_transform_siri" {
  source = "../modules/data-pipelines/transform-avl-siri"

  environment = local.env
  region      = data.aws_region.current.name
  account_id  = data.aws_caller_identity.current.account_id
}

module "avl_firehose" {
  source = "../modules/data-pipelines/avl-kinesis-firehose"

  environment               = local.env
  region                    = data.aws_region.current.name
  account_id                = data.aws_caller_identity.current.account_id
  transform_siri_lambda_arn = module.avl_lambda_transform_siri.avl_transform_siri_lambda_arn
}

locals {
  env = "dev"
}
