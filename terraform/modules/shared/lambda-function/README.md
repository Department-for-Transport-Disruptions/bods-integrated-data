<!-- BEGIN_AUTOMATED_TF_DOCS_BLOCK -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | >= 1.6.6 |
| <a name="requirement_aws"></a> [aws](#requirement\_aws) | ~> 5.33 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_aws"></a> [aws](#provider\_aws) | ~> 5.33 |

## Resources

| Name | Type |
|------|------|
| [aws_cloudwatch_event_rule.schedule](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_rule) | resource |
| [aws_cloudwatch_event_target.schedule_lambda](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_target) | resource |
| [aws_lambda_function.function](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function) | resource |
| [aws_lambda_permission.allow_bucket_trigger](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_permission) | resource |
| [aws_lambda_permission.allow_events_bridge_to_run_lambda](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_permission) | resource |
| [aws_s3_bucket_notification.bucket_notification](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket_notification) | resource |
| [aws_lambda_function.existing_function](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/lambda_function) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_env_vars"></a> [env\_vars](#input\_env\_vars) | Map of environment variables | `map(string)` | `null` | no |
| <a name="input_function_name"></a> [function\_name](#input\_function\_name) | n/a | `string` | n/a | yes |
| <a name="input_handler"></a> [handler](#input\_handler) | n/a | `string` | n/a | yes |
| <a name="input_memory"></a> [memory](#input\_memory) | n/a | `number` | n/a | yes |
| <a name="input_role_arn"></a> [role\_arn](#input\_role\_arn) | n/a | `string` | n/a | yes |
| <a name="input_runtime"></a> [runtime](#input\_runtime) | n/a | `string` | n/a | yes |
| <a name="input_s3_bucket_trigger"></a> [s3\_bucket\_trigger](#input\_s3\_bucket\_trigger) | ID and ARN of the bucket which will trigger the function when new objects are uploaded | `map(string)` | `null` | no |
| <a name="input_schedule"></a> [schedule](#input\_schedule) | Provide cron schedule or rate to trigger the lambda on a schedule | `string` | `null` | no |
| <a name="input_security_group_ids"></a> [security\_group\_ids](#input\_security\_group\_ids) | List of Security Group IDs to use for a VPC lambda | `list(string)` | `null` | no |
| <a name="input_subnet_ids"></a> [subnet\_ids](#input\_subnet\_ids) | List of subnet IDs to use for a VPC lambda | `list(string)` | `null` | no |
| <a name="input_timeout"></a> [timeout](#input\_timeout) | n/a | `number` | n/a | yes |
| <a name="input_zip_path"></a> [zip\_path](#input\_zip\_path) | n/a | `string` | n/a | yes |
<!-- END_AUTOMATED_TF_DOCS_BLOCK -->