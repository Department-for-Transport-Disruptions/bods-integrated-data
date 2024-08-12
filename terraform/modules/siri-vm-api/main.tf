resource "aws_api_gateway_rest_api" "siri_vm_api" {
  name = "${var.api_name}-${var.environment}"

  endpoint_configuration {
    types = [var.private ? "PRIVATE" : "REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "siri_vm_api_downloader_resource" {
  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  parent_id   = aws_api_gateway_rest_api.siri_vm_api.root_resource_id
  path_part   = "siri-vm"
}

resource "aws_api_gateway_method" "siri_vm_api_downloader_method" {
  rest_api_id   = aws_api_gateway_rest_api.siri_vm_api.id
  resource_id   = aws_api_gateway_resource.siri_vm_api_downloader_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "siri_vm_api_downloader_integration" {
  rest_api_id             = aws_api_gateway_rest_api.siri_vm_api.id
  resource_id             = aws_api_gateway_resource.siri_vm_api_downloader_resource.id
  http_method             = aws_api_gateway_method.siri_vm_api_downloader_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = var.siri_vm_downloader_invoke_arn
}

resource "aws_lambda_permission" "siri_vm_downloader_api_permissions" {
  action        = "lambda:InvokeFunction"
  function_name = var.siri_vm_downloader_function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}"
}

resource "aws_api_gateway_deployment" "siri_vm_api_deployment" {
  depends_on = [
    aws_api_gateway_integration.siri_vm_api_downloader_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  stage_name  = "v1"
}

resource "aws_api_gateway_rest_api_policy" "siri_vm_api_resource_policy" {
  count = var.private && var.external_vpce_for_sirivm_downloader != null ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.siri_vm_api.id
  policy = jsonencode({
    Version = "2008-10-17"
    Statement = [
      {
        "Effect" : "Deny",
        "Principal" : "*",
        "Action" : "execute-api:Invoke",
        "Resource" : "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}",
        "Condition" : {
          "StringNotEquals" : {
            "aws:sourceVpce" : var.external_vpce_for_sirivm_downloader
          }
        }
      },
      {
        "Effect" : "Allow",
        "Principal" : "*",
        "Action" : "execute-api:Invoke",
        "Resource" : "arn:aws:execute-api:${var.aws_region}:${var.account_id}:${aws_api_gateway_rest_api.siri_vm_api.id}/*/${aws_api_gateway_method.siri_vm_api_downloader_method.http_method}${aws_api_gateway_resource.siri_vm_api_downloader_resource.path}"
      }
    ]
  })
}
