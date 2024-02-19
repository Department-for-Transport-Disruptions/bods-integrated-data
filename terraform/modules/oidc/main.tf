terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.33"
    }
  }
}

// oidc provider
resource "aws_iam_openid_connect_provider" "main" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"
  ]
}

// role
data "aws_iam_policy_document" "github_oidc_assume_role_policy" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.main.arn]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:Department-for-Transport-Disruptions/bods-integrated-data:environment:${var.environment}"]
    }
  }
}

resource "aws_iam_policy" "integrated_data_oidc_github_actions_policy" {
  name = "integrated-data-oidc-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "rds:*",
          "s3:*",
          "lambda:*",
          "ec2:*",
          "s3-object-lambda:*"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role" "oidc_github_actions_role" {
  name               = "integrated-data-github-actions-role-${var.environment}"
  path               = "/"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume_role_policy.json
  managed_policy_arns = [
    aws_iam_policy.integrated_data_oidc_policy.arn
  ]
}
