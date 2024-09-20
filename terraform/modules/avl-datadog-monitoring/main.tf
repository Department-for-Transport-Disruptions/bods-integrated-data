terraform {
  required_providers {
    datadog = {
      source  = "DataDog/datadog"
      version = "3.41.0"
    }
  }
}

provider "datadog" {
  api_url = var.datadog_api_url
  api_key = var.datadog_api_key
  app_key = var.datadog_app_key
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "datadog_aws_integration" {
  name               = "integrated-data-avl-datadog-role-${var.environment}"
  description        = "Role for Datadog AWS Integration"
  assume_role_policy = data.aws_iam_policy_document.datadog_aws_integration_assume_role.json

  lifecycle {
    ignore_changes = [
      assume_role_policy,
    ]
  }
}

data "aws_iam_policy_document" "datadog_aws_integration_assume_role" {
  statement {
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::464622532012:root"]
    }
    actions = ["sts:AssumeRole"]
    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values = [
        var.datadog_external_id
      ]
    }
  }
}

resource "aws_iam_policy" "datadog_aws_integration" {
  name   = "integrated-data-avl-${var.environment}-datadog-aws-integration-policy"
  policy = data.aws_iam_policy_document.datadog_aws_integration.json
}

data "aws_iam_policy_document" "datadog_aws_integration" {
  statement {
    //Only given the permissions to the resources we use to start with - see https://docs.datadoghq.com/integrations/amazon_web_services/?tab=roledelegation#all-permissions
    actions = [
      "apigateway:GET",
      "cloudfront:GetDistributionConfig",
      "cloudfront:ListDistributions",
      "cloudwatch:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "ec2:Describe*",
      "lambda:GetPolicy",
      "lambda:List*",
      "logs:DeleteSubscriptionFilter",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:DescribeSubscriptionFilters",
      "logs:FilterLogEvents",
      "logs:PutSubscriptionFilter",
      "logs:TestMetricFilter",
      "rds:Describe*",
      "rds:List*",
      "route53:List*",
      "s3:GetBucketLogging",
      "s3:GetBucketLocation",
      "s3:GetBucketNotification",
      "s3:GetBucketTagging",
      "s3:ListAllMyBuckets",
      "s3:PutBucketNotification",
      "sqs:ListQueues",
      "states:ListStateMachines",
      "states:DescribeStateMachine",
      "tag:GetResources",
      "tag:GetTagKeys",
      "tag:GetTagValues",
      "elasticache:DescribeCacheClusters",
      "elasticache:DescribeCacheSubnetGroups",
      "elasticache:DescribeReplicationGroups",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeTrustStores"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy_attachment" "datadog_aws_integration" {
  role       = aws_iam_role.datadog_aws_integration.name
  policy_arn = aws_iam_policy.datadog_aws_integration.arn
}

resource "datadog_integration_aws" "datadog_aws_integration" {
  account_id = data.aws_caller_identity.current.account_id
  role_name  = aws_iam_role.datadog_aws_integration.name
}
