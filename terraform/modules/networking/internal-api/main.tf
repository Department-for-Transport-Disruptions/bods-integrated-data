terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_security_group" "internal_api_nlb_sg" {
  name   = "integrated-data-internal-api-nlb-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_security_group" "internal_api_alb_sg" {
  name   = "integrated-data-internal-api-alb-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "internal_api_nlb_sg_vpn_ingress" {
  security_group_id = aws_security_group.internal_api_nlb_sg.id
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = var.external_ip_range
}

resource "aws_vpc_security_group_egress_rule" "internal_api_nlb_sg_alb_egress_ipv4" {
  security_group_id            = aws_security_group.internal_api_nlb_sg.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.internal_api_alb_sg.id
}

resource "aws_vpc_security_group_ingress_rule" "internal_api_alb_sg_nlb_ingress" {
  security_group_id            = aws_security_group.internal_api_alb_sg.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.internal_api_nlb_sg.id
}

resource "aws_vpc_security_group_egress_rule" "internal_api_alb_sg_all_egress_ipv4" {
  security_group_id = aws_security_group.internal_api_alb_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_lb_target_group" "internal_api_alb_tg" {
  name        = "internal-api-alb-tg-${var.environment}"
  target_type = "ip"
  protocol    = "HTTP"
  port        = 8080
  vpc_id      = var.vpc_id

  health_check {
    path                = "/health"
    interval            = 60
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
  }
}

resource "aws_lb" "internal_api_alb" {
  name               = "api-internal-alb-${var.environment}"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.internal_api_alb_sg.id]
  subnets            = var.lb_subnet_ids

  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_listener" "internal_api_alb_listener" {
  load_balancer_arn = aws_lb.internal_api_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.internal_api_alb_tg.arn

  }
}

resource "aws_lb" "internal_api_nlb" {
  name               = "api-internal-nlb-${var.environment}"
  internal           = true
  load_balancer_type = "network"
  security_groups    = [aws_security_group.internal_api_nlb_sg.id]
  subnets            = var.lb_subnet_ids

  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_target_group" "internal_api_nlb_tg" {
  name        = "internal-api-nlb-tg-${var.environment}"
  target_type = "alb"
  port        = 80
  protocol    = "TCP"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/health"
    interval            = 60
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
  }

  depends_on = [aws_lb.internal_api_nlb, aws_lb_listener.internal_api_alb_listener]
}

resource "aws_lb_target_group_attachment" "internal_api_nlb_tg_attachment" {
  target_group_arn = aws_lb_target_group.internal_api_nlb_tg.arn
  target_id        = aws_lb.internal_api_alb.id
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
