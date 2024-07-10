terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

locals {
  downloader_origin_id    = "avl-siri-vm-downloader"
  data_producer_origin_id = "avl-producer-api"
}

resource "aws_cloudfront_distribution" "avl_siri_vm_distribution" {
  origin {
    domain_name              = trimsuffix(trimprefix(var.avl_siri_vm_downloader_domain, "https://"), "/")
    origin_id                = local.downloader_origin_id
    origin_path              = "/siri-vm"
    origin_access_control_id = aws_cloudfront_origin_access_control.avl_siri_vm_downloader_access_control.id

    custom_origin_config {
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      http_port              = 80
      https_port             = 443
    }
  }

  enabled         = true
  is_ipv6_enabled = true
  aliases         = ["avl.${var.domain}"]
  price_class     = "PriceClass_100"

  default_cache_behavior {
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.downloader_origin_id

    forwarded_values {
      query_string = true

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_cloudfront_origin_access_control" "avl_siri_vm_downloader_access_control" {
  name                              = "avl-siri-vm-downloader-access-control-${var.environment}"
  description                       = "Access control policy for the AVL SIRI-VM downloader function"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_lambda_permission" "avl_siri_vm_downloader_invoke" {
  statement_id  = "AllowCloudFrontServicePrincipal"
  action        = "lambda:InvokeFunctionUrl"
  function_name = var.avl_siri_vm_downloader_function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.avl_siri_vm_distribution.arn
}

resource "aws_route53_record" "integrated_data_avl_consumer_api_dns_record" {
  name    = "avl.${var.domain}"
  type    = "A"
  zone_id = var.hosted_zone_id

  alias {
    name                   = aws_cloudfront_distribution.avl_siri_vm_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.avl_siri_vm_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_wafv2_ip_set" "avl_siri_vm_data_producer_ip_set" {
  name               = "avl_siri_vm_data_producer_ip_set"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"

  addresses = var.avl_siri_vm_data_producer_allowed_ips
}

resource "aws_wafv2_regex_pattern_set" "avl_siri_vm_data_producer_waf_regex_pattern" {
  name  = "avl_siri_vm_data_producer_waf_regex_pattern"
  scope = "CLOUDFRONT"

  regular_expression {
    regex_string = "^/subscriptions/[^/]+$" # Match /subscriptions/{subscriptionId}
  }
}


resource "aws_wafv2_web_acl" "avl_siri_vm_data_producer_waf" {
  name        = "avl_siri_vm_data_producer_waf"
  scope       = "CLOUDFRONT"
  description = "Data producer web ACL to restrict by IP"

  default_action {
    allow {}
  }
  rule {
    name     = "AllowDataEndpoint"
    priority = 1

    action {
      allow {}
    }

    statement {
      regex_pattern_set_reference_statement {
        arn = aws_wafv2_regex_pattern_set.avl_siri_vm_data_producer_waf_regex_pattern.arn
        field_to_match {
          uri_path {}
        }
        text_transformation {
          priority = 0
          type     = "NONE"
        }
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "AllowSpecificEndpoint"
    }
  }
  rule {
    name     = "IPAllowRule"
    priority = 1

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.avl_siri_vm_data_producer_ip_set.arn
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "IPAllowRule"
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "avl_siri_vm_data_producer_waf"
    sampled_requests_enabled   = true
  }
}


resource "aws_cloudfront_distribution" "avl_siri_vm_data_producer_distribution" {
  origin {
    domain_name = trimsuffix(trimprefix(var.avl_siri_vm_data_producer_domain, "https://"), "/")
    origin_id   = local.data_producer_origin_id

    custom_origin_config {
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      http_port              = 80
      https_port             = 443
    }
  }

  enabled         = true
  is_ipv6_enabled = true
  aliases         = ["avl.${var.domain}"]
  price_class     = "PriceClass_100"

  default_cache_behavior {
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.data_producer_origin_id

    forwarded_values {
      query_string = true

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  web_acl_id = aws_wafv2_web_acl.avl_siri_vm_data_producer_waf.id
}