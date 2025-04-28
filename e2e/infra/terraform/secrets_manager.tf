resource "aws_secretsmanager_secret" "fpjs_proxy_lambda_secret" {
  name        = "fingerprint-pro-cloudfront-integration-settings-secret-${local.integration_id}"
  description = "AWS Secret with a custom Fingerprint integration settings (created via Terraform)"
}

resource "aws_secretsmanager_secret_version" "fpjs_proxy_lambda_secret" {
  secret_id = aws_secretsmanager_secret.fpjs_proxy_lambda_secret.id
  secret_string = jsonencode(
    {
      fpjs_get_result_path     = var.fpjs_get_result_path
      fpjs_agent_download_path = var.fpjs_agent_download_path
      fpjs_pre_shared_secret   = var.fpjs_shared_secret
    }
  )
}