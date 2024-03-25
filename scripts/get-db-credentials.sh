#!/bin/bash

arn=$(aws secretsmanager list-secrets | jq -r '.SecretList[]|select(.Name | startswith("rds!")).ARN')

aws secretsmanager get-secret-value --secret-id $arn | jq -r '.SecretString' | jq .