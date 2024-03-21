# BODS Integrated Data

This repo contains the code for the BODS Integrated Data platform, this encompasses the following functionality:

- GTFS and GTFS-RT generation
- AVL Data Pipeline
- Data Warehouse

## Local Development

### Requirements

This repo uses asdf to manage the versions of various dependencies, install that first before proceeding with the setup.

- asdf
  - https://asdf-vm.com/guide/getting-started.html
- AWS CLI Session Manager Plugin
  - https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
- Docker
  - https://rancherdesktop.io/
- awslocal
  - https://github.com/localstack/awscli-local
- pnpm
  - https://pnpm.io/installation

### Local Setup

After installing the above dependencies, run the following to install the required asdf plugins and install the desired versions. It will then start the docker containers for postgres and localstack, create the needed localstack resources and then run the local DB migrations:

```bash
make asdf setup
```

Log in to the AWS CLI:

```bash
aws configure sso
# SSO session name (Recommended): bods-integrated-data
# SSO start URL [None]: {RETRIEVE FROM AWS SSO CONFIG}
# SSO region [None]: eu-west-2
# SSO registration scopes [None]: sso:account:access
```

Optionally set a default AWS profile for future use. In your AWS config at `~/.aws/config` change the profile to a user-friendly name and set the region:

```bash
[profile bods-integrated-data-dev]
...
region = eu-west-2
```

Then export the profile as a shell variable:

```bash
export AWS_PROFILE=bods-integrated-data-dev
```

### Creating and invoking lambda functions locally

All the current lambda functions should be created when running the `make setup` command.

If you wish to create them all manually you can run:

```bash
make create-lambdas
```

Similarly, if you wish to delete all the lambdas:

```bash
make delete-lambdas
```

And if you want to delete and recreate all lambdas:

```bash
make remake-lambdas
```

These commands can also be run for individual lambdas:

```bash
make create-lambda-{LAMBDA_NAME}
make delete-lambda-{LAMBDA_NAME}
make remake-lambda-{LAMBDA_NAME}
```

So if you wanted to update a lambda after changing the code, you could run:

```bash
make build-functions

make remake-lambda-{LAMBDA_NAME}
# OR
make remake-lambdas
```

To invoke a lambda, simply run:

```bash
make invoke-local-{LAMBDA_NAME}

# Some lambdas require a variable to be passed
FILE=bods.zip make invoke-local-bods-txc-unzipper
```

### Terraform

To run terraform plans and applies locally, first init the Terraform workspace:

```bash
make tf-init-{ENV}
```

then use the provided Make commands:

```bash
make tf-plan-{ENV}
make tf-apply-{ENV}
```

for example, to run a plan against the dev environment, run `make tf-plan-dev` after authenticating against the dev AWS account.

### Deploying lambda function changes

If there's a need to deploy lambda code changes locally (best to use the CI where possible), the functions need to be built first, run:

```bash
make install-deps build-functions
```

to do this. Then run a `make tf-apply-{ENV}` to deploy the changes. Terraform will see the new bundled functions and deploy the changes.

## Adding or updating secrets

[SOPS](https://github.com/getsops/sops) is used to handle secrets and configuration for terraform. This uses an AWS KMS key to encrypt a secrets file which can then be committed into version control.

In order to add or update a secret, first authenticate against the target AWS account (where the required KMS key resides) and then run the following from the root directory:

```bash
make edit-secrets-{ENV}
```

This will open a text editor so you can edit the secrets file, when you save the changes to the file then SOPS will automatically encrypt the new file which can then be pushed.

### Using SOPS secrets in Terraform

To use a secret from SOPS in terraform, you first need to reference SOPS as a required provider, then reference the secrets file in a data block. The secrets can then be extracted. An example of this would be:

```terraform
sops = {
    source  = "carlpett/sops"
    version = "~> 1.0"
}

data "sops_file" "secrets" {
  source_file = "secrets.enc.json"
}

locals {
    secret_example = jsondecode(data.sops_file.secrets.raw)["secret_name"]
}
```

## CI Pipelines

On creating a Pull Request, a Github Actions pipeline will trigger which will generate a terraform plan and save it as a comment to the Pull Request. It will also run tflint and run the tests for the lambda functions.

When the PR is approved, the CI will run a terraform apply, this is to ensure that any code in main will successfully deploy. After it has deployed successfully, the code can be merged.

The pipelines will detect which lambda functions have been updated and it will only build those functions, this ensures that terraform will only apply changes to functions that have actually been changed as part of the PR.
