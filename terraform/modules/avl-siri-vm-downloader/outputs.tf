output "avl_siri_vm_downloader_lambda_name" {
  value = module.integrated_data_avl_siri_vm_downloader_function.function_name
}

output "avl_siri_vm_downloader_invoke_arn" {
  value = module.integrated_data_avl_siri_vm_downloader_function.invoke_arn
}

output "avl_siri_vm_downloader_function_url" {
  value = aws_lambda_function_url.avl_siri_vm_downloader_function_url.function_url
}
