resource "aws_route53_zone" "integrated_data_private_hosted_zone" {
  name = "bods-integrated-data.internal"

  vpc {
    vpc_id = var.vpc_id
  }
}
