terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

resource "aws_security_group" "internal_api_nlb_sg" {
  name   = "integrated-data-internal-api-nlb-sg-${var.environment}"
  vpc_id = var.vpc_id
}
resource "aws_vpc_security_group_ingress_rule" "internal_api_nlb_sg_vpn_ingress" {
  security_group_id = aws_security_group.internal_api_nlb_sg.id
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = var.external_ip_range
}

resource "aws_vpc_security_group_ingress_rule" "internal_api_nlb_sg_public_ingress" {
  count = var.environment != "prod" ? 1 : 0

  security_group_id = aws_security_group.internal_api_nlb_sg.id
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_lb_target_group" "internal_api_nlb_tg" {
  name        = "internal-api-nlb-tg-${var.environment}"
  target_type = "ip"
  protocol    = "TCP"
  port        = 8080
  vpc_id      = var.vpc_id

  health_check {
    path                = "/health"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
  }
}

resource "aws_lb" "internal_api_nlb" {
  name               = "api-internal-nlb-${var.environment}"
  internal           = var.environment == "prod" ? true : false
  load_balancer_type = "network"
  security_groups    = [aws_security_group.internal_api_nlb_sg.id]
  subnets            = var.nlb_subnet_ids

  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_listener" "internal_api_nlb_listener" {
  load_balancer_arn = aws_lb.internal_api_nlb.arn
  port              = 80
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.internal_api_nlb_tg.arn
  }
}

resource "aws_vpc_endpoint_service" "vpc_endpoint_service" {
  acceptance_required        = true
  allowed_principals         = ["arn:aws:iam::${var.external_account_id}:root"]
  network_load_balancer_arns = [aws_lb.internal_api_nlb.arn]
  supported_ip_address_types = ["ipv4"]
}
