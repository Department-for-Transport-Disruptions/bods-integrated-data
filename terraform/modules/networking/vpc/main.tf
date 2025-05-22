terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

# VPC

resource "aws_vpc" "integrated_data_vpc" {
  cidr_block       = var.vpc_cidr
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
  for_each = {
    for idx, subnet in var.db_subnet_cidr_blocks :
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
  for_each = {
    for idx, subnet in var.private_subnet_cidr_blocks :
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

resource "aws_subnet" "integrated_data_public_subnet" {
  for_each = {
    for idx, subnet in var.public_subnet_cidr_blocks :
    idx => {
      name       = "integrated-data-public-subnet-${idx + 1}-${var.environment}"
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

# Internet Gateway

resource "aws_internet_gateway" "integrated_data_igw" {
  vpc_id = aws_vpc.integrated_data_vpc.id

  tags = {
    Name = "integrated-data-igw-${var.environment}"
  }
}

# NAT Gateway

resource "aws_eip" "integrated_data_nat_gateway_eip" {
  for_each = {
    for idx, nat_gateway in local.nat_gateways :
    idx => {
      name = "integrated-data-nat-gateway-eip-${idx + 1}-${var.environment}"
    }
  }

  tags = {
    Name = each.value.name
  }
}

resource "aws_nat_gateway" "integrated_data_nat_gateway" {
  for_each = {
    for idx, eip in aws_eip.integrated_data_nat_gateway_eip :
    idx => {
      name   = "integrated-data-nat-gateway-${idx + 1}-${var.environment}"
      idx    = idx
      eip_id = eip.id
    }
  }

  subnet_id     = aws_subnet.integrated_data_public_subnet[each.value.idx].id
  allocation_id = each.value.eip_id

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
  for_each = {
    for idx, nat_gateway in aws_nat_gateway.integrated_data_nat_gateway :
    idx => {
      name           = "integrated-data-private-subnet-rt-${idx + 1}-${var.environment}"
      nat_gateway_id = nat_gateway.id
    }
  }

  vpc_id = aws_vpc.integrated_data_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = each.value.nat_gateway_id
  }

  tags = {
    Name = each.value.name
  }
}

resource "aws_route_table" "integrated_data_public_subnet_route_table" {
  vpc_id = aws_vpc.integrated_data_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.integrated_data_igw.id
  }

  tags = {
    Name = "integrated-data-public-subnet-rt-${var.environment}"
  }
}

# Route Table Associations

resource "aws_route_table_association" "integrated_data_db_subnet_route_table_assoc" {
  for_each = aws_subnet.integrated_data_db_subnet

  route_table_id = aws_route_table.integrated_data_db_subnet_route_table.id
  subnet_id      = each.value.id
}

resource "aws_route_table_association" "integrated_data_private_subnet_route_table_assoc" {
  for_each = {
    for idx, private_subnet in aws_subnet.integrated_data_private_subnet :
    idx => {
      idx       = idx
      subnet_id = private_subnet.id
    }
  }

  route_table_id = length(local.nat_gateways) > 1 ? aws_route_table.integrated_data_private_subnet_route_table[each.value.idx].id : aws_route_table.integrated_data_private_subnet_route_table[0].id
  subnet_id      = each.value.subnet_id
}

resource "aws_route_table_association" "integrated_data_public_subnet_route_table_assoc" {
  for_each = aws_subnet.integrated_data_public_subnet

  route_table_id = aws_route_table.integrated_data_public_subnet_route_table.id
  subnet_id      = each.value.id
}

# VPC Endpoints

resource "aws_vpc_endpoint" "integrated_data_s3_vpc_gateway_endpoint" {
  vpc_id       = aws_vpc.integrated_data_vpc.id
  service_name = "com.amazonaws.${var.region}.s3"
}

resource "aws_vpc_endpoint" "integrated_data_dynamodb_vpc_gateway_endpoint" {
  vpc_id       = aws_vpc.integrated_data_vpc.id
  service_name = "com.amazonaws.${var.region}.dynamodb"
}

resource "aws_vpc_endpoint_route_table_association" "integrated_data_s3_vpc_gateway_endpoint_private_route_table_association" {
  for_each        = aws_route_table.integrated_data_private_subnet_route_table
  route_table_id  = each.value.id
  vpc_endpoint_id = aws_vpc_endpoint.integrated_data_s3_vpc_gateway_endpoint.id
}

resource "aws_vpc_endpoint_route_table_association" "integrated_data_dynamodb_vpc_gateway_endpoint_private_route_table_association" {
  for_each        = aws_route_table.integrated_data_private_subnet_route_table
  route_table_id  = each.value.id
  vpc_endpoint_id = aws_vpc_endpoint.integrated_data_dynamodb_vpc_gateway_endpoint.id
}

resource "aws_vpc_endpoint_route_table_association" "integrated_data_s3_vpc_gateway_endpoint_db_route_table_association" {
  route_table_id  = aws_route_table.integrated_data_db_subnet_route_table.id
  vpc_endpoint_id = aws_vpc_endpoint.integrated_data_s3_vpc_gateway_endpoint.id
}

resource "aws_vpc_endpoint_route_table_association" "integrated_data_dynamodb_vpc_gateway_endpoint_db_route_table_association" {
  route_table_id  = aws_route_table.integrated_data_db_subnet_route_table.id
  vpc_endpoint_id = aws_vpc_endpoint.integrated_data_dynamodb_vpc_gateway_endpoint.id
}

locals {
  nat_gateways = var.environment == "prod" ? var.private_subnet_cidr_blocks : [var.private_subnet_cidr_blocks[0]]
}
