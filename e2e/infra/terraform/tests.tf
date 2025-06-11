resource "null_resource" "tests" {
  count = var.run_tests ? 1 : 0

  provisioner "local-exec" {
    command     = "pnpm test"
    working_dir = "../../tests"
    environment = {
      CLOUDFRONT_WITH_HEADERS_URL = aws_cloudfront_distribution.with_headers.domain_name
      CLOUDFRONT_WITH_SECRETS_URL = aws_cloudfront_distribution.with_secret.domain_name
    }
  }
  triggers = {
    # We need to define this to run on every `terraform apply`
    run_id = timestamp()
  }

  # Make sure that we run this after cloudfront is ready
  depends_on = [
    aws_cloudfront_distribution.with_headers, aws_cloudfront_distribution.with_secret,
    null_resource.invalidate_with_headers_cache, null_resource.invalidate_with_secret_cache
  ]
}

resource "null_resource" "mock-warden-tests" {
  count = var.run_mock_warden_tests ? 1 : 0

  provisioner "local-exec" {
    command     = "ts-node e2e/scripts/mockTests.ts --project tsconfig.json"
    working_dir = "../../../"
    environment = {
      CLOUDFRONT_WITH_HEADERS_URL = aws_cloudfront_distribution.with_headers.domain_name
      CLOUDFRONT_WITH_SECRETS_URL = aws_cloudfront_distribution.with_secret.domain_name
      FPJS_BEHAVIOR_PATH          = var.fpjs_behavior_path
      FPJS_AGENT_DOWNLOAD_PATH    = var.fpjs_agent_download_path
      FPJS_GET_RESULT_PATH        = var.fpjs_get_result_path
      API_URL                     = var.mock_warden_url
    }
  }

  triggers = {
    # We need to define this to run on every `terraform apply`
    run_id = timestamp()
  }

  # Make sure that we run this after cloudfront is ready
  depends_on = [
    aws_cloudfront_distribution.with_headers, aws_cloudfront_distribution.with_secret,
    null_resource.invalidate_with_headers_cache, null_resource.invalidate_with_secret_cache
  ]
}