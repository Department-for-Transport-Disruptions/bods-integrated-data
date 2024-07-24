terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

# VPN

resource "aws_customer_gateway" "customer_gateway" {
  type       = "ipsec.1"
  bgp_asn    = "65000"
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

resource "aws_cloudwatch_log_group" "tunnel_1_log_group" {
  name              = "integrated-data-${var.vpn_name}-tunnel-1"
  retention_in_days = var.environment == "prod" ? 90 : 30
}

resource "aws_cloudwatch_log_group" "tunnel_2_log_group" {
  name              = "integrated-data-${var.vpn_name}-tunnel-2"
  retention_in_days = var.environment == "prod" ? 90 : 30
}

resource "aws_vpn_connection" "vpn_connection" {
  type                = "ipsec.1"
  customer_gateway_id = aws_customer_gateway.customer_gateway.id
  vpn_gateway_id      = aws_vpn_gateway.vgw.id
  static_routes_only  = true

  tunnel1_log_options {
    cloudwatch_log_options {
      log_enabled       = true
      log_group_arn     = aws_cloudwatch_log_group.tunnel_1_log_group.arn
      log_output_format = "json"
    }
  }

  tunnel2_log_options {
    cloudwatch_log_options {
      log_enabled       = true
      log_group_arn     = aws_cloudwatch_log_group.tunnel_2_log_group.arn
      log_output_format = "json"
    }
  }

  tunnel1_ike_versions = ["ikev2"]
  tunnel2_ike_versions = ["ikev2"]

  tunnel1_phase1_dh_group_numbers = [14]
  tunnel1_phase2_dh_group_numbers = [14]
  tunnel2_phase1_dh_group_numbers = [14]
  tunnel2_phase2_dh_group_numbers = [14]

  tunnel1_phase1_encryption_algorithms = ["AES256"]
  tunnel1_phase2_encryption_algorithms = ["AES256"]
  tunnel2_phase1_encryption_algorithms = ["AES256"]
  tunnel2_phase2_encryption_algorithms = ["AES256"]

  tunnel1_phase1_integrity_algorithms = ["SHA2-256"]
  tunnel1_phase2_integrity_algorithms = ["SHA2-256"]
  tunnel2_phase1_integrity_algorithms = ["SHA2-256"]
  tunnel2_phase2_integrity_algorithms = ["SHA2-256"]

  tunnel1_phase1_lifetime_seconds = 28800
  tunnel1_phase2_lifetime_seconds = 3600
  tunnel2_phase1_lifetime_seconds = 28800
  tunnel2_phase2_lifetime_seconds = 3600

  tunnel1_dpd_timeout_action = "none"
  tunnel2_dpd_timeout_action = "none"


  tags = {
    Name = "integrated-data-${var.vpn_name}-vpn-connection-${var.environment}"
  }
}

resource "aws_vpn_connection_route" "connection_route" {
  destination_cidr_block = var.destination_cidr_block
  vpn_connection_id      = aws_vpn_connection.vpn_connection.id
}

resource "aws_vpn_gateway_route_propagation" "route_propagation" {
  for_each = var.private_route_table_ids

  vpn_gateway_id = aws_vpn_gateway.vgw.id
  route_table_id = each.value

  depends_on = [aws_vpn_connection.vpn_connection]
}
