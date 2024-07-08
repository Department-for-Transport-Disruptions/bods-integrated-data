terraform {
  required_version = ">= 1.6.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.54"
    }
  }
}

data "aws_ami" "amzn_linux_2023_ami" {
  most_recent = true

  filter {
    name   = "owner-alias"
    values = ["amazon"]
  }

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}


data "aws_iam_policy_document" "bastion_instance_trust_policy" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "integrated_data_bastion_role" {
  assume_role_policy   = data.aws_iam_policy_document.bastion_instance_trust_policy.json
  managed_policy_arns  = ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore", "arn:aws:iam::aws:policy/EC2InstanceConnect"]
  max_session_duration = "3600"
  name                 = "integrated-data-bastion-role-${var.environment}"
  path                 = "/"
}

resource "aws_iam_instance_profile" "integrated_data_bastion_instance_profile" {
  name = "integrated-data-bastion-instance-profile-${var.environment}"
  role = aws_iam_role.integrated_data_bastion_role.id
}

resource "aws_security_group" "integrated_data_bastion_sg" {
  name   = "integrated-data-bastion-sg-${var.environment}"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_vpc_interface_endpoint_sg_allow_bastion_ingress" {
  security_group_id            = var.interface_endpoint_sg_id
  referenced_security_group_id = aws_security_group.integrated_data_bastion_sg.id

  from_port = 443
  to_port   = 443

  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_bastion_sg_allow_ingress_from_vpc" {
  security_group_id = aws_security_group.integrated_data_bastion_sg.id

  cidr_ipv4   = var.vpc_cidr
  ip_protocol = "tcp"
  from_port   = 443
  to_port     = 443
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_bastion_sg_allow_all_egress_ipv4" {
  security_group_id = aws_security_group.integrated_data_bastion_sg.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_egress_rule" "integrated_data_bastion_sg_allow_all_egress_ipv6" {
  security_group_id = aws_security_group.integrated_data_bastion_sg.id

  cidr_ipv6   = "::/0"
  ip_protocol = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "integrated_data_db_sg_allow_bastion_ingress" {
  security_group_id = var.db_sg_id

  referenced_security_group_id = aws_security_group.integrated_data_bastion_sg.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_launch_template" "integrated_data_bastion_launch_template" {
  name                   = "integrated-data-bastion-launch-template-${var.environment}"
  image_id               = data.aws_ami.amzn_linux_2023_ami.id
  instance_type          = "t3.small"
  vpc_security_group_ids = [aws_security_group.integrated_data_bastion_sg.id]

  iam_instance_profile {
    arn = aws_iam_instance_profile.integrated_data_bastion_instance_profile.arn
  }

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name    = "integrated-data-bastion-host-${var.environment}"
      Bastion = true
    }
  }
}

resource "aws_autoscaling_group" "integrated_data_bastion_asg" {
  name                = "integrated-data-bastion-asg-${var.environment}"
  min_size            = 1
  max_size            = 1
  vpc_zone_identifier = var.private_subnet_ids

  launch_template {
    id      = aws_launch_template.integrated_data_bastion_launch_template.id
    version = "$Latest"
  }
}
