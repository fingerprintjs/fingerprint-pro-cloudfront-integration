data "aws_s3_object" "fpjs_integration_s3_bucket" {
  bucket = "fingerprint-pro-cloudfront-integration"
  key    = "v2/lambda_latest.zip"
}

locals {
  package_zip = "package.zip"
}

data "archive_file" "lambda_package" {
  type        = "zip"
  source_file = "../../../dist/fingerprintjs-pro-cloudfront-lambda-function.js"
  output_path = local.package_zip
}

resource "aws_lambda_function" "fpjs_proxy_lambda" {
  description = "Fingerprint Proxy Lambda@Edge function"

  filename = var.use_local_lambda ? local.package_zip : null

  s3_bucket        = !var.use_local_lambda ? data.aws_s3_object.fpjs_integration_s3_bucket.bucket : null
  s3_key           = !var.use_local_lambda ? data.aws_s3_object.fpjs_integration_s3_bucket.key : null
  function_name    = "fingerprint-pro-cloudfront-lambda-${local.integration_id}"
  role             = aws_iam_role.fpjs_proxy_lambda.arn
  handler          = "fingerprintjs-pro-cloudfront-lambda-function.handler"
  source_code_hash = var.use_local_lambda ? data.archive_file.lambda_package.output_base64sha256 : data.aws_s3_object.fpjs_integration_s3_bucket.checksum_sha256
  memory_size      = 128
  timeout          = 10

  runtime = "nodejs20.x"

  publish = true
}