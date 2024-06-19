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
  origin_id = "avl-siri-vm-downloader"
}

resource "aws_cloudfront_distribution" "avl_siri_vm_distribution" {
  origin {
    domain_name              = trimsuffix(trimprefix(var.avl_siri_vm_downloader_domain, "https://"), "/")
    origin_id                = local.origin_id
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

  default_cache_behavior {
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.origin_id

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
    cloudfront_default_certificate = true
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
