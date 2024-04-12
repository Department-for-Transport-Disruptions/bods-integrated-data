# Local

This folder contains the terraform configuration code to deploy infrastructure locally using Localstack

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
3. First init the terraform workspace using:

```bash
make tf-init-local
```

4. You can then run terraform plans and applies using the following make commands:

```bash
make tf-plan-local
Run `make tf-apply-local
```

### Tip:

It's recommended to install the Localstack Desktop application to help view and manage the infrastructure you have
deployed locally.

When using Localstack, it will default to viewing resources deployed in `us-east-1`, make sure to update this to
the region you expect resources to be deployed to.

Localstack Desktop:

- https://docs.localstack.cloud/user-guide/tools/localstack-desktop/


