terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_route53_zone" "integrated_data_private_hosted_zone" {
  name = "bods-integrated-data.internal"

  vpc {
    vpc_id = var.vpc_id
  }
}

resource "aws_route53_zone" "integrated_data_public_hosted_zone" {
  name = "${var.environment}.${var.root_domain}"
}
