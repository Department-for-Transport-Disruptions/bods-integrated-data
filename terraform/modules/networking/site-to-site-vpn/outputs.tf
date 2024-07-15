output "subnet_ids" {
  value = [
    for subnet in aws_subnet.integrated_data_vpn_subnet : subnet.id
  ]
}
