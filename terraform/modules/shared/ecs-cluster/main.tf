terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
  }
}

resource "aws_ecs_cluster" "avl_ecs_cluster" {
  name = "${var.cluster_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
