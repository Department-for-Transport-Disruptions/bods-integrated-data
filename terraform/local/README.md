# Local

This folder contains the terraform configuration code to deploy infrastructure locally using local stack

## Pre-Reqs

Make sure to follow the steps to set up your local environment as detailed in the README in the root directory.

In this project we have configured Terraform to use Localstack by using the `tflocal` wrapper script to automatically
configure the service endpoints to point to Localstack:

- tflocal
    - https://github.com/localstack/terraform-local

For further reading of see the Localstack docs: https://docs.localstack.cloud/user-guide/integrations/terraform/

## Usage

When you start your local environment using the `make setup` command it will automatically deploy the infrastructure
defined in this directory's `main.tf` file.

Currently, the following infrastructure is deployed:

- AVL mock data producer
- AVL subscriptions dynamo table
- AVL avl-subscriber lambda function
- AVL avl-data-endpoint lambda function with a lambda function URL

## Local Development

When developing new infrastructure it can be useful to use Localstack to deploy infrastructure locally for testing.

To do this, follow these steps:

1. Follow the existing repo pattern of creating infrastructure within the `modules` directory.
2. Import your module into this /local `main.tf` file.
3. In your terminal navigate to `/terraform/local` directory
4. Run `tflocal plan` which will run a terraform plan using localstack
5. Run `tflocal apply` which will run a terraform apply using localstack

### Tip:

It's recommended to install the Localstack Desktop application to help view and manage the infrastructure you have
deployed locally.

Localstack Desktop:

- https://docs.localstack.cloud/user-guide/tools/localstack-desktop/


