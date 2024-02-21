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
  }
}

data "aws_region" "current" {}

module "integrated_data_vpc_dev" {
  source      = "../modules/vpc"
  environment = "dev"
  region      = data.aws_region.current.name
}

module "integrated_data_route53" {
  source = "../modules/route-53"

  vpc_id = module.integrated_data_vpc_dev.vpc_id
}

module "integrated_data_aurora_db_dev" {
  source = "../modules/aurora-db"

  environment              = "dev"
  db_subnet_ids            = module.integrated_data_vpc_dev.db_subnet_ids
  vpc_id                   = module.integrated_data_vpc_dev.vpc_id
  private_hosted_zone_id   = module.integrated_data_route53.private_hosted_zone_id
  private_hosted_zone_name = module.integrated_data_route53.private_hosted_zone_name
}

module "integrated_data_bastion_host" {
  source = "../modules/bastion-host"

  environment              = "dev"
  db_sg_id                 = module.integrated_data_aurora_db_dev.db_sg_id
  private_subnet_ids       = module.integrated_data_vpc_dev.private_subnet_ids
  vpc_id                   = module.integrated_data_vpc_dev.vpc_id
  vpc_cidr                 = module.integrated_data_vpc_dev.vpc_cidr
  interface_endpoint_sg_id = module.integrated_data_vpc_dev.interface_endpoint_sg_id
}

module "integrated_data_db_migrator" {
  source = "../modules/db-migrator"

  environment        = "dev"
  vpc_id             = module.integrated_data_vpc_dev.vpc_id
  private_subnet_ids = module.integrated_data_vpc_dev.private_subnet_ids
  db_secret_arn      = module.integrated_data_aurora_db_dev.db_secret_arn
  db_sg_id           = module.integrated_data_aurora_db_dev.db_sg_id
  db_host            = module.integrated_data_aurora_db_dev.db_host

}

module "integrated_data_dms" {
  source             = "../modules/dms"
  environment        = "dev"
  private_subnet_ids = [module.integrated_data_vpc_dev.private_subnet_ids]
}
