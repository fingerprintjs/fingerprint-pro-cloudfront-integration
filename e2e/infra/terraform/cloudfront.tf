resource "aws_cloudfront_distribution" "with_secret" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront distribution for E2E Tests using Secrets Manager"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id       = aws_s3_bucket.website_bucket.bucket_domain_name
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  origin {
    domain_name = aws_s3_bucket.website_bucket.bucket_domain_name
    origin_id   = aws_s3_bucket.website_bucket.bucket_domain_name
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  origin {
    domain_name = var.fpjs_origin_name
    origin_id   = var.fpjs_origin_id
    custom_origin_config {
      origin_protocol_policy = "https-only"
      http_port              = 80
      https_port             = 443
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    custom_header {
      name  = "FPJS_SECRET_NAME"
      value = aws_secretsmanager_secret.fpjs_proxy_lambda_secret.arn
    }
  }

  ordered_cache_behavior {
    path_pattern = "${var.fpjs_behavior_path}/*"

    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = aws_cloudfront_cache_policy.fpjs_procdn.id
    origin_request_policy_id = var.fpjs_origin_request_policy_id
    target_origin_id         = var.fpjs_origin_id
    viewer_protocol_policy   = "https-only"
    compress                 = true

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.fpjs_proxy_lambda.qualified_arn
      include_body = true
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_cloudfront_distribution" "with_headers" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront distribution for E2E Tests using headers"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id       = aws_s3_bucket.website_bucket.bucket_domain_name
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  origin {
    domain_name = aws_s3_bucket.website_bucket.bucket_domain_name
    origin_id   = aws_s3_bucket.website_bucket.bucket_domain_name
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  origin {
    domain_name = var.fpjs_origin_name
    origin_id   = var.fpjs_origin_id
    custom_origin_config {
      origin_protocol_policy = "https-only"
      http_port              = 80
      https_port             = 443
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    custom_header {
      name  = "fpjs_pre_shared_secret"
      value = var.fpjs_shared_secret
    }

    custom_header {
      name  = "fpjs_get_result_path"
      value = var.fpjs_get_result_path
    }

    custom_header {
      name  = "fpjs_agent_download_path"
      value = var.fpjs_agent_download_path
    }
  }

  ordered_cache_behavior {
    path_pattern = "${var.fpjs_behavior_path}/*"

    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = aws_cloudfront_cache_policy.fpjs_procdn.id
    origin_request_policy_id = var.fpjs_origin_request_policy_id
    target_origin_id         = var.fpjs_origin_id
    viewer_protocol_policy   = "https-only"
    compress                 = true

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.fpjs_proxy_lambda.qualified_arn
      include_body = true
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

output "cloudfront_with_headers_url" {
  value = aws_cloudfront_distribution.with_headers.domain_name
}

output "cloudfront_with_secret_url" {
  value = aws_cloudfront_distribution.with_secret.domain_name
}