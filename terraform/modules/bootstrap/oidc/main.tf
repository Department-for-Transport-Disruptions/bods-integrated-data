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
      values   = ["repo:Department-for-Transport-Disruptions/bods-integrated-data:*"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_policy" "integrated_data_oidc_github_actions_policy" {
  name = "integrated-data-github-actions-policy-${var.environment}"

  policy = var.environment == "shared-services" ? jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ecr:*",
        ],
        Effect   = "Allow",
        Resource = "*",
        Condition = {
          "StringLike" = {
            "aws:RequestedRegion" = [
              "eu-west-2",
              "us-east-1"
            ]
          }
        }
      },
      {
        Action = [
          "kms:Decrypt"
        ],
        Effect   = "Allow",
        Resource = [var.sops_kms_key_arn]
      }
    ]
  }): jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "iam:AddRoleToInstanceProfile",
          "iam:AttachRolePolicy",
          "iam:CreatePolicy",
          "iam:CreatePolicyVersion",
          "iam:CreateRole",
          "iam:CreateServiceLinkedRole",
          "iam:DeletePolicy",
          "iam:DeletePolicyVersion",
          "iam:DeleteRole",
          "iam:DeleteRolePermissionsBoundary",
          "iam:DeleteRolePolicy",
          "iam:DeleteServiceLinkedRole",
          "iam:DetachRolePolicy",
          "iam:*InstanceProfile*",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:GetServiceLinkedRoleDeletionStatus",
          "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole",
          "iam:ListPolicyVersions",
          "iam:ListRolePolicies",
          "iam:ListRoleTags",
          "iam:ListRoles",
          "iam:PassRole",
          "iam:PutRolePermissionsBoundary",
          "iam:PutRolePolicy",
          "iam:RemoveRoleFromInstanceProfile",
          "iam:SetDefaultPolicyVersion",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:UpdateRole",
          "iam:UpdateRoleDescription",
          "route53:*",
          "secretsmanager:CreateSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:DeleteSecret",
          "secretsmanager:DescribeSecret",
          "secretsmanager:TagResource",
          "secretsmanager:UntagResource",
          "secretsmanager:GetResourcePolicy"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        Action = [
          "rds:*",
          "s3:*",
          "lambda:*",
          "firehose:*",
          "ec2:*",
          "autoscaling:*",
          "s3-object-lambda:*",
          "route53:*",
          "cloudwatch:*",
          "dynamodb:*",
          "events:*",
          "logs:*",
          "sns:*",
          "sqs:*",
          "apigateway:*",
          "states:*",
          "acm:*",
          "scheduler:*",
          "ecs:*"
        ],
        Effect   = "Allow",
        Resource = "*",
        Condition = {
          "StringLike" = {
            "aws:RequestedRegion" = [
              "eu-west-2",
              "us-east-1"
            ]
          }
        }
      },
      {
        Action = [
          "kms:Decrypt"
        ],
        Effect   = "Allow",
        Resource = [var.sops_kms_key_arn]
      }
    ]
  })
}

resource "aws_iam_role" "oidc_github_actions_role" {
  name               = "integrated-data-github-actions-role-${var.environment}"
  path               = "/"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_assume_role_policy.json
  managed_policy_arns = [
    aws_iam_policy.integrated_data_oidc_github_actions_policy.arn
  ]
}
