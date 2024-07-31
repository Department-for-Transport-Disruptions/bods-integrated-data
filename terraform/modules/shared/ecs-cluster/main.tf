resource "aws_ecs_cluster" "avl_ecs_cluster" {
  name = "${var.cluster_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}
