resource "aws_cloudfront_cache_policy" "fpjs_procdn" {
  name        = "FingerprintProCDNCachePolicy-${local.integration_id}"
  default_ttl = 180
  max_ttl     = 180
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }

    headers_config {
      header_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["version", "loaderVersion"]
      }
    }

    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}
