terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

# Subnets and routes

data "aws_availability_zones" "available" {}

resource "aws_subnet" "integrated_data_vpn_subnet" {
  for_each = {
    for idx, cidr_block in var.subnet_cidr_blocks :
    idx => {
      idx        = idx
      cidr_block = cidr_block
    }
  }

  vpc_id            = var.vpc_id
  cidr_block        = each.value.cidr_block
  availability_zone = element(data.aws_availability_zones.available.names, each.key)

  tags = {
    Name = "integrated-data-${var.vpn_name}-vpn-subnet-${each.value.idx + 1}-${var.environment}"
  }
}

resource "aws_route_table" "integrated_data_vpn_subnet_route_table" {
  vpc_id = var.vpc_id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.nat_gateway_id
  }

  tags = {
    Name = "integrated-data-${var.vpn_name}-vpn-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "integrated_data_vpn_subnet_route_table_assoc" {
  for_each = aws_subnet.integrated_data_vpn_subnet

  route_table_id = aws_route_table.integrated_data_vpn_subnet_route_table.id
  subnet_id      = each.value.id
}

# VPN

resource "aws_customer_gateway" "customer_gateway" {
  type       = "ipsec.1"
  bgp_asn    = "65123"
  ip_address = var.customer_gateway_ip

  tags = {
    Name = "integrated-data-${var.vpn_name}-customer-gateway-${var.environment}"
  }
}

resource "aws_vpn_gateway" "vgw" {
  vpc_id = var.vpc_id

  tags = {
    Name = "integrated-data-${var.vpn_name}-vgw-${var.environment}"
  }
}

resource "aws_vpn_connection" "vpn_connection" {
  type                = "ipsec.1"
  customer_gateway_id = aws_customer_gateway.customer_gateway.id
  vpn_gateway_id      = aws_vpn_gateway.vgw.id
  static_routes_only  = true


  tags = {
    Name = "integrated-data-${var.vpn_name}-vpn-connection-${var.environment}"
  }
}

resource "aws_vpn_connection_route" "connection_route" {
  destination_cidr_block = var.destination_cidr_block
  vpn_connection_id      = aws_vpn_connection.vpn_connection.id
}

resource "aws_vpn_gateway_route_propagation" "route_propagation" {
  vpn_gateway_id = aws_vpn_gateway.vgw.id
  route_table_id = aws_route_table.integrated_data_vpn_subnet_route_table.id
}
