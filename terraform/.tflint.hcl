plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

plugin "aws" {
    enabled = true
    version = "0.47.0"
    source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

// remove this after lambda runtime is upgraded
rule "aws_lambda_function_deprecated_runtime" {
  enabled = false
}
