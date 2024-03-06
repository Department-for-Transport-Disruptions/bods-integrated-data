terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

# VPC

resource "aws_vpc" "integrated_data_vpc" {
  cidr_block       = local.vpc_cidr
  instance_tenancy = "default"

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "integrated-data-vpc-${var.environment}"
  }
}

# Subnets 

data "aws_availability_zones" "available" {}

resource "aws_subnet" "integrated_data_db_subnet" {
  for_each = { for idx, subnet in local.db_subnet_cidr_blocks :
    idx => {
      name       = "integrated-data-db-subnet-${idx + 1}-${var.environment}"
      cidr_block = subnet
    }
  }

  vpc_id            = aws_vpc.integrated_data_vpc.id
  cidr_block        = each.value.cidr_block
  availability_zone = element(data.aws_availability_zones.available.names, each.key)

  tags = {
    Name = each.value.name
  }
}

resource "aws_subnet" "integrated_data_private_subnet" {
  for_each = { for idx, subnet in local.private_subnet_cidr_blocks :
    idx => {
      name       = "integrated-data-private-subnet-${idx + 1}-${var.environment}"
      cidr_block = subnet
    }
  }

  vpc_id            = aws_vpc.integrated_data_vpc.id
  cidr_block        = each.value.cidr_block
  availability_zone = element(data.aws_availability_zones.available.names, each.key)

  tags = {
    Name = each.value.name
  }
}

# Route Tables

resource "aws_route_table" "integrated_data_db_subnet_route_table" {
  vpc_id = aws_vpc.integrated_data_vpc.id

  tags = {
    Name = "integrated-data-db-subnet-rt-${var.environment}"
  }
}

resource "aws_route_table" "integrated_data_private_subnet_route_table" {
  vpc_id = aws_vpc.integrated_data_vpc.id

  tags = {
    Name = "integrated-data-private-subnet-rt-${var.environment}"
  }
}

# Route Table Associations

resource "aws_route_table_association" "integrated_data_db_subnet_route_table_assoc" {
  for_each = aws_subnet.integrated_data_db_subnet

  route_table_id = aws_route_table.integrated_data_db_subnet_route_table.id
  subnet_id      = each.value.id
}

resource "aws_route_table_association" "integrated_data_private_subnet_route_table_assoc" {
  for_each = aws_subnet.integrated_data_private_subnet

  route_table_id = aws_route_table.integrated_data_private_subnet_route_table.id
  subnet_id      = each.value.id
}

# VPC Endpoints

resource "aws_security_group" "integrated_data_vpc_interface_endpoint_sg" {
  name   = "integrated-data-vpc-interface-endpoint-sg-${var.environment}"
  vpc_id = aws_vpc.integrated_data_vpc.id
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_vpc_interface_endpoint_sg_allow_all_egress_ipv4" {
  security_group_id = aws_security_group.integrated_data_vpc_interface_endpoint_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_vpc_interface_endpoint_sg_allow_all_egress_ipv6" {
  security_group_id = aws_security_group.integrated_data_vpc_interface_endpoint_sg.id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_vpc_interface_endpoint_sg_allow_ingress_from_vpc" {
  security_group_id = aws_security_group.integrated_data_vpc_interface_endpoint_sg.id

  cidr_ipv4   = aws_vpc.integrated_data_vpc.cidr_block
  ip_protocol = "tcp"
  from_port   = 443
  to_port     = 443
}

resource "aws_vpc_endpoint" "integrated_data_vpc_interface_endpoint" {
  for_each            = toset(local.vpc_interface_endpoint_services)
  vpc_id              = aws_vpc.integrated_data_vpc.id
  service_name        = "com.amazonaws.${var.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids = [
    for subnet in aws_subnet.integrated_data_private_subnet : subnet.id
  ]
  security_group_ids = [aws_security_group.integrated_data_vpc_interface_endpoint_sg.id]
  tags = {
    Name = "integrated-data-${each.value}-vpc-endpoint-${var.environment}"
  }
}

resource "aws_vpc_endpoint" "integrated_data_vpc_gateway_endpoint" {
  for_each     = toset(local.vpc_gateway_endpoint_services)
  vpc_id       = aws_vpc.integrated_data_vpc.id
  service_name = "com.amazonaws.${var.region}.${each.value}"
}

resource "aws_vpc_endpoint_route_table_association" "integrated_data_vpc_gateway_endpoint_route_table_association" {
  for_each        = aws_vpc_endpoint.integrated_data_vpc_gateway_endpoint
  route_table_id  = aws_route_table.integrated_data_private_subnet_route_table.id
  vpc_endpoint_id = each.value.id
}

locals {
  vpc_cidr                        = "10.0.0.0/16"
  db_subnet_cidr_blocks           = ["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidr_blocks      = ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"]
  vpc_interface_endpoint_services = ["ssm", "ssmmessages", "secretsmanager", "lambda"]
  vpc_gateway_endpoint_services   = ["s3"]
}
