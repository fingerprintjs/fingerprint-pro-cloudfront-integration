resource "aws_iam_role_policy" "fpjs_proxy_lambda" {
  name = "AWSSecretAccess"
  role = aws_iam_role.fpjs_proxy_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "secretsmanager:GetSecretValue",
        ]
        Effect   = "Allow"
        Resource = aws_secretsmanager_secret.fpjs_proxy_lambda_secret.arn
      },
    ]
  })
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"
    sid    = "AllowAwsToAssumeRole"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "fpjs_proxy_lambda" {
  name                 = "fingerprint-pro-lambda-role-${local.integration_id}"
  permissions_boundary = var.fpjs_proxy_lambda_role_permissions_boundary_arn
  assume_role_policy   = data.aws_iam_policy_document.assume_role.json
  managed_policy_arns  = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
}

