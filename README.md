# BODS Integrated Data

This repo contains the code for the BODS Integrated Data platform, this encompasses the following functionality:

-   GTFS and GTFS-RT generation
-   AVL Data Pipeline
-   Data Warehouse

## Local Development

### Requirements

This repo uses asdf to manage the versions of various dependencies, install that first before proceeding with the setup.

-   asdf
    -   https://asdf-vm.com/guide/getting-started.html
-   AWS CLI Session Manager Plugin
    -   https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
-   Docker
    -   https://rancherdesktop.io/
-   awslocal
    -   https://github.com/localstack/awscli-local

### Local Setup

After installing the above dependencies, run the following:

```bash
make asdf setup
```

to install the required asdf plugins and install the desired versions. It will then start the docker containers for postgres and localstack, create the needed localstack resources and then run the local DB migrations.

### Terraform

To run terraform plans and applies locally, use the provided Make commands:

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
