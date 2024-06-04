#!/bin/bash

IS_TEMP=$1

arn=$([[ $IS_TEMP == 'true' ]] && aws secretsmanager list-secrets | jq -r '.SecretList[]|select(.Name | startswith("rds!"))|select(.Description | contains("temp")).ARN' || aws secretsmanager list-secrets | jq -r '.SecretList[]|select(.Name | startswith("rds!"))|select(.Description | contains("temp") | not).ARN')

aws secretsmanager get-secret-value --secret-id $arn | jq -r '.SecretString' | jq .