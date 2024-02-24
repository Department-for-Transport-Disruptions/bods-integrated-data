#!/bin/bash

shopt -s lastpipe

cd ./terraform

# Install terraform-docs
curl -sSLo ./terraform-docs.tar.gz https://terraform-docs.io/dl/v0.17.0/terraform-docs-v0.17.0-$(uname)-amd64.tar.gz
tar -xzf terraform-docs.tar.gz
chmod +x terraform-docs
mkdir docs
cp terraform-docs /usr/local/bin

# Go to modules folder
cd ./modules

# Create an array of directories to create READMEs for
find . -name "main.tf" -print0 | while IFS= read -r -d '' file
do
    dir=$(dirname "$file")
    docDir+=($dir);
done

# Generate READMEs for directories
for dir in "${docDir[@]}"
do
  terraform-docs -c ../.tfdocs-config.yml $dir
done