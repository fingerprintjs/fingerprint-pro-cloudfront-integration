module "fingerprint_cloudfront_integration" {
  source = "fingerprintjs/fingerprint-cloudfront-proxy-integration/aws"

  fpjs_agent_download_path = var.fpjs_agent_download_path
  fpjs_get_result_path     = var.fpjs_get_result_path
  fpjs_shared_secret       = var.fpjs_shared_secret
  fetch_lambda_from_s3     = false
  local_lambda_path        = "../../../dist/fingerprintjs-pro-cloudfront-lambda-function.js"
}