output "nlb_target_group_arn" {
  value = aws_lb_target_group.internal_api_nlb_tg.arn
}

output "nlb_sg_id" {
  value = aws_security_group.internal_api_nlb_sg.id
}
