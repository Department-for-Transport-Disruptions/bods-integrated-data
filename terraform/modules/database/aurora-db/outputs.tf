output "db_sg_id" {
  value = aws_security_group.integrated_data_db_sg.id
}

output "db_host" {
  value = aws_route53_record.integrated_data_db_cname_record.name
}

output "db_secret_arn" {
  value = aws_rds_cluster.integrated_data_rds_cluster.master_user_secret[0].secret_arn
}

output "db_endpoint" {
  value = aws_rds_cluster_instance.integrated_data_postgres_db_instance.endpoint
}
