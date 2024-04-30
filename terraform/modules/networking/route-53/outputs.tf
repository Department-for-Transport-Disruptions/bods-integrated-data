output "private_hosted_zone_id" {
  value = aws_route53_zone.integrated_data_private_hosted_zone.id
}

output "private_hosted_zone_name" {
  value = aws_route53_zone.integrated_data_private_hosted_zone.name
}

output "public_hosted_zone_id" {
  value = aws_route53_zone.integrated_data_public_hosted_zone.id
}

output "public_hosted_zone_name" {
  value = aws_route53_zone.integrated_data_public_hosted_zone.name
}
