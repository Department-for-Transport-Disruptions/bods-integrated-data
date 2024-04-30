terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

resource "aws_acm_certificate" "integrated_data_acm_certificate" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"
}

resource "aws_route53_record" "integrated_data_acm_validation_record" {
  for_each = {
    for dvo in aws_acm_certificate.integrated_data_acm_certificate.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.hosted_zone_id
}

resource "aws_acm_certificate_validation" "integrated_data_acm_validation" {
  certificate_arn         = aws_acm_certificate.integrated_data_acm_certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.integrated_data_acm_validation_record : record.fqdn]
}
