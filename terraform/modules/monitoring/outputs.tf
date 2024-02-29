output "ok_topic_arn" {
  value = aws_sns_topic.integrated_data_ok_topic.arn
}

output "alarm_topic_arn" {
  value = aws_sns_topic.integrated_data_alarm_topic.arn
}
