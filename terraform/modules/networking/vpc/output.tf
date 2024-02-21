output "vpc_id" {
  value = aws_vpc.integrated_data_vpc.id
}

output "vpc_cidr" {
  value = aws_vpc.integrated_data_vpc.cidr_block
}

output "db_subnet_ids" {
  value = [
    for subnet in aws_subnet.integrated_data_db_subnet : subnet.id
  ]
}

output "private_subnet_ids" {
  value = [
    for subnet in aws_subnet.integrated_data_private_subnet : subnet.id
  ]
}

output "interface_endpoint_sg_id" {
  value = aws_security_group.integrated_data_vpc_interface_endpoint_sg.id
}
