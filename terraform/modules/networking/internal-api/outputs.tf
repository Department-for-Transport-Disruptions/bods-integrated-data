output "alb_target_group_arn" {
  value = aws_lb_target_group.internal_api_alb_tg.arn
}

output "alb_sg_id" {
  value = aws_security_group.internal_api_alb_sg.id
}
