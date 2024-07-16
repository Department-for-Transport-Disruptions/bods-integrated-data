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

output "default_sg_id" {
  value = aws_vpc.integrated_data_vpc.default_security_group_id
}

output "nat_gateway_id" {
  value = aws_nat_gateway.integrated_data_nat_gateway[0].id
}

output "private_route_table_ids" {
  value = [
    for rt in aws_route_table.integrated_data_private_subnet_route_table : rt.id
  ]
}
