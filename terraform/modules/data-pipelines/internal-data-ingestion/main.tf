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

resource "aws_security_group" "internal_data_ingestion_alb_sg" {
  name   = "integrated-data-internal-avl-data-alb-sg-${var.environment}"
  vpc_id = var.vpc_id
}

moved {
  from = aws_security_group.internal_avl_ingestion_alb_sg
  to   = aws_security_group.internal_data_ingestion_alb_sg
}

resource "aws_vpc_security_group_ingress_rule" "internal_data_ingestion_alb_sg_nlb_ingress" {
  security_group_id            = aws_security_group.internal_data_ingestion_alb_sg.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.internal_data_ingestion_nlb_sg.id
}

moved {
  from = aws_vpc_security_group_ingress_rule.internal_avl_ingestion_alb_sg_nlb_ingress
  to   = aws_vpc_security_group_ingress_rule.internal_data_ingestion_alb_sg_nlb_ingress
}

resource "aws_vpc_security_group_egress_rule" "internal_data_ingestion_alb_sg_all_egress_ipv4" {
  security_group_id = aws_security_group.internal_data_ingestion_alb_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

moved {
  from = aws_vpc_security_group_egress_rule.internal_avl_ingestion_alb_sg_all_egress_ipv4
  to   = aws_vpc_security_group_egress_rule.internal_data_ingestion_alb_sg_all_egress_ipv4
}

resource "aws_security_group" "internal_data_ingestion_nlb_sg" {
  name   = "integrated-data-internal-avl-data-nlb-sg-${var.environment}"
  vpc_id = var.vpc_id
}

moved {
  from = aws_security_group.internal_avl_ingestion_nlb_sg
  to   = aws_security_group.internal_data_ingestion_nlb_sg
}

resource "aws_vpc_security_group_ingress_rule" "internal_data_ingestion_nlb_sg_vpn_ingress" {
  security_group_id = aws_security_group.internal_data_ingestion_nlb_sg.id
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = var.external_ip_range
}

moved {
  from = aws_vpc_security_group_ingress_rule.internal_avl_ingestion_nlb_sg_vpn_ingress
  to   = aws_vpc_security_group_ingress_rule.internal_data_ingestion_nlb_sg_vpn_ingress
}

resource "aws_vpc_security_group_egress_rule" "internal_data_ingestion_nlb_sg_alb_egress_ipv4" {
  security_group_id            = aws_security_group.internal_data_ingestion_nlb_sg.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.internal_data_ingestion_alb_sg.id
}

moved {
  from = aws_vpc_security_group_egress_rule.internal_avl_ingestion_nlb_sg_alb_egress_ipv4
  to   = aws_vpc_security_group_egress_rule.internal_data_ingestion_nlb_sg_alb_egress_ipv4
}

resource "aws_lb_target_group" "internal_avl_ingestion_alb_tg" {
  name        = "avl-data-alb-tg-${var.environment}"
  target_type = "lambda"
  port        = 80

  health_check {
    enabled = false
  }
}

resource "aws_lb_target_group" "internal_cancellations_ingestion_alb_tg" {
  name        = "cancellations-data-alb-tg-${var.environment}"
  target_type = "lambda"
  port        = 80

  health_check {
    enabled = false
  }
}

resource "aws_lambda_permission" "internal_avl_data_endpoint_alb_tg_permissions" {
  statement_id  = "AllowExecutionFromlb"
  action        = "lambda:InvokeFunction"
  function_name = var.avl_data_endpoint_function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.internal_avl_ingestion_alb_tg.arn
}

resource "aws_lambda_permission" "internal_cancellations_data_endpoint_alb_tg_permissions" {
  statement_id  = "AllowCancellationsExecutionFromlb"
  action        = "lambda:InvokeFunction"
  function_name = var.cancellations_data_endpoint_function_name
  principal     = "elasticloadbalancing.amazonaws.com"
  source_arn    = aws_lb_target_group.internal_avl_ingestion_alb_tg.arn
}

resource "aws_lb_target_group_attachment" "internal_avl_ingestion_alb_tg_attachment" {
  target_group_arn = aws_lb_target_group.internal_avl_ingestion_alb_tg.arn
  target_id        = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.avl_data_endpoint_function_name}"
  depends_on       = [aws_lambda_permission.internal_avl_data_endpoint_alb_tg_permissions]
}

resource "aws_lb_target_group_attachment" "internal_cancellations_ingestion_alb_tg_attachment" {
  target_group_arn = aws_lb_target_group.internal_cancellations_ingestion_alb_tg.arn
  target_id        = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.cancellations_data_endpoint_function_name}"
  depends_on       = [aws_lambda_permission.internal_cancellations_data_endpoint_alb_tg_permissions]
}

resource "aws_lb" "internal_data_ingestion_alb" {
  name               = "avl-data-alb-${var.environment}"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.internal_data_ingestion_alb_sg.id]
  subnets            = var.lb_subnet_ids

  enable_deletion_protection = var.environment == "prod"
}

moved {
  from = aws_lb.internal_avl_ingestion_alb
  to   = aws_lb.internal_data_ingestion_alb
}

resource "aws_lb_listener" "internal_data_ingestion_alb_listener" {
  load_balancer_arn = aws_lb.internal_data_ingestion_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.internal_avl_ingestion_alb_tg.arn
  }
}

moved {
  from = aws_lb_listener.internal_avl_ingestion_alb_listener
  to   = aws_lb_listener.internal_data_ingestion_alb_listener
}

resource "aws_lb_listener_rule" "internal_cancellations_ingestion_alb_listener_rule" {
  listener_arn = aws_lb_listener.internal_data_ingestion_alb_listener.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.internal_cancellations_ingestion_alb_tg.arn
  }

  condition {
    path_pattern {
      values = ["/cancellations/*"]
    }
  }
}

resource "aws_lb" "internal_data_ingestion_nlb" {
  name                       = "avl-data-nlb-${var.environment}"
  internal                   = true
  load_balancer_type         = "network"
  security_groups            = [aws_security_group.internal_data_ingestion_nlb_sg.id]
  enable_deletion_protection = var.environment == "prod"

  subnet_mapping {
    subnet_id            = var.lb_subnet_ids[0]
    private_ipv4_address = var.nlb_ip_address
  }
}

moved {
  from = aws_lb.internal_avl_ingestion_nlb
  to   = aws_lb.internal_data_ingestion_nlb
}

resource "aws_lb_target_group" "internal_data_ingestion_nlb_tg" {
  name        = "avl-data-nlb-tg-${var.environment}"
  target_type = "alb"
  port        = 80
  protocol    = "TCP"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/health"
    interval            = 120
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
  }

  depends_on = [aws_lb.internal_data_ingestion_nlb, aws_lb_listener.internal_data_ingestion_alb_listener]
}

moved {
  from = aws_lb_target_group.internal_avl_ingestion_nlb_tg
  to   = aws_lb_target_group.internal_data_ingestion_nlb_tg
}

resource "aws_lb_target_group_attachment" "internal_data_ingestion_nlb_tg_attachment" {
  target_group_arn = aws_lb_target_group.internal_data_ingestion_nlb_tg.arn
  target_id        = aws_lb.internal_data_ingestion_alb.id
}

moved {
  from = aws_lb_target_group_attachment.internal_avl_ingestion_nlb_tg_attachment
  to   = aws_lb_target_group_attachment.internal_data_ingestion_nlb_tg_attachment
}

resource "aws_lb_listener" "internal_data_ingestion_nlb_listener" {
  load_balancer_arn = aws_lb.internal_data_ingestion_nlb.arn
  port              = 80
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.internal_data_ingestion_nlb_tg.arn
  }
}

moved {
  from = aws_lb_listener.internal_avl_ingestion_nlb_listener
  to   = aws_lb_listener.internal_data_ingestion_nlb_listener
}
