# BODS Integrated Data

Code for the Bus Open Data Service (BODS) integrated data platform, which includes the following:

- [AVL](<https://www.gov.uk/government/publications/bus-open-data-implementation-guide/bus-open-data-implementation-guide#:~:text=of%20the%20UK.-,Automatic%20Vehicle%20Location%20(AVL),-%3A%20automatic%20vehicle%20location>)
  data subscriptions
- [GTFS](https://gtfs.org/) feed generation via [TransXChange](https://www.gov.uk/government/collections/transxchange)
  data mapping

Visit
the [Bus open data implementation guide](https://www.gov.uk/government/publications/bus-open-data-implementation-guide/bus-open-data-implementation-guide)
for more information about BODS.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Dependencies](#dependencies)
  - [Code Linting \& Formatting](#code-linting--formatting)
  - [Log in with the AWS CLI](#log-in-with-the-aws-cli)
- [Installation](#installation)
- [Usage](#usage)
  - [AVL subscriptions](#avl-subscriptions)
  - [NOC data retrieval](#noc-data-retrieval)
  - [NaPTAN data retrieval](#naptan-data-retrieval)
  - [NPTG data retrieval](#nptg-data-retrieval)
  - [Bank holidays data retrieval](#bank-holidays-data-retrieval)
  - [TXC data retrieval and processing](#txc-data-retrieval-and-processing)
    - [Bus Open Data Service (BODS)](#bus-open-data-service-bods)
    - [Traveline National Dataset (TNDS)](#traveline-national-dataset-tnds)
    - [Renaming tables](#renaming-tables)
  - [GTFS feed generation](#gtfs-feed-generation)
    - [GTFS Schedule](#gtfs-schedule)
    - [GTFS Realtime](#gtfs-realtime)
  - [Creating and invoking lambda functions locally](#creating-and-invoking-lambda-functions-locally)
  - [CLI Helpers](#cli-helpers)
  - [Manually updating ECS services](#manually-updating-ecs-services)
- [Configuration](#configuration)
  - [Adding and updating secrets](#adding-and-updating-secrets)
  - [Using secrets in Terraform](#using-secrets-in-terraform)
- [Testing](#testing)
- [Logging](#logging)
- [CICD](#cicd)
  - [Workflow](#workflow)
  - [Environments](#environments)
  - [Deploying changes locally](#deploying-changes-locally)

## Dependencies

The following dependencies are required. An AWS account is also required.

| Dependency                                                                                                                                  | Description                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [asdf](https://asdf-vm.com/guide/getting-started.html)                                                                                      | Runtime version manager                                                                                          |
| [AWS Session Manager Plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) | Session management plugin for AWS CLI                                                                            |
| [awslocal](https://github.com/localstack/awscli-local)                                                                                      | localstack wrapper for AWS CLI                                                                                   |
| [Docker](https://rancherdesktop.io/)                                                                                                        | Platform for running containerised code                                                                          |
| [tflocal](https://github.com/localstack/terraform-local)                                                                                    | A small wrapper script to run [Terraform](https://terraform.io/) against [localstack](https://localstack.cloud/) |

The following dependencies are installed via asdf:

| Dependency                             | Description           |
| -------------------------------------- | --------------------- |
| [AWS CLI](https://aws.amazon.com/cli/) | AWS command line tool |
| [pnpm](https://pnpm.io/installation)   | Package manager       |
| [terraform](https://www.terraform.io/) | Terraform             |

The following dependencies are optional:

| Dependency                                          | Description               |
| --------------------------------------------------- | ------------------------- |
| [localstack desktop](https://www.localstack.cloud/) | Desktop UI for localstack |

### Code Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting code. Follow the instructions on their
website to set up Biome for your
editor - [Intregate Biome in your editor](https://biomejs.dev/guides/integrate-in-editor/).

### Log in with the AWS CLI

```bash
aws configure sso
# SSO session name (Recommended): bods-integrated-data
# SSO start URL [None]: {RETRIEVE FROM AWS SSO CONFIG}
# SSO region [None]: eu-west-2
# SSO registration scopes [None]: sso:account:access
```

Optionally set a default AWS profile for future use. In your AWS config at `~/.aws/config` change the profile to a
user-friendly name and set the region:

```bash
[profile bods-integrated-data-dev]
...
region = eu-west-2
```

Then export the profile as a shell variable:

```bash
export AWS_PROFILE=bods-integrated-data-dev
```

## Installation

The provided Makefile includes commands for installing and running software. To begin:

```bash
make asdf setup
```

This will:

- install required asdf plugins
- start docker containers for postgres and localstack
- install and build all functions
- run local database migrations
- create localstack resources in the Terraform local workspace

Run the local `db-cleardown` function to create the remaining database tables:

```bash
make run-local-db-cleardown
```

Connect to the database with your preferred database client:

```text
Host: localhost
Port: 5432
Username: postgres
Password: password
```

## Usage

### AVL subscriptions

todo

### NOC data retrieval

The National Operator Code (NOC) dataset contains unique codes for registered operators that are used to link data
together during mapping.

Download the NOC dataset into the localstack container:

```bash
make run-local-noc-retriever
```

Insert NOC data into the database:

```bash
make run-local-noc-processor
```

### NaPTAN data retrieval

The National Public Transport Access Nodes (NaPTAN) dataset contains information for uniquely identifying all public
transport access points.

Download the NaPTAN dataset into the localstack container:

```bash
make run-local-naptan-retriever
```

Insert NaPTAN data into the database:

```bash
make run-local-naptan-uploader
```

### NPTG data retrieval

The National Public Transport Gazetteer (NPTG) dataset contains geographical data for all cities, towns, villages and
localities.

Download the NPTG dataset into the localstack container:

```bash
make run-local-nptg-retriever
```

Insert NPTG data into the database:

```bash
make run-local-nptg-uploader
```

### Bank holidays data retrieval

The bank holidays dataset contains data for UK bank holidays.

Download the bank holidays dataset into the localstack container:

```bash
make run-local-bank-holidays-retriever
```

### TXC data retrieval and processing

#### Bus Open Data Service (BODS)

> BODS data mapping requires NOC, NapTAN and NPTG data to exist in the database first (see relevant sections above).

BODS data is publicly available. Download all TXC data into the localstack container:

```bash
make run-local-bods-txc-retriever
```

BODS provides multiple archives. The resulting files can be listed using the AWS CLI:

```bash
awslocal s3api list-objects --bucket integrated-data-bods-txc-zipped-local
```

Unzip a specified archive:

```bash
make run-local-bods-txc-unzipper FILE="20240502/1st_Bus_Stop_Ltd_330/remote_dataset_8883_2024-04-04_14-21-21.zip"
```

The resulting files can be listed using the AWS CLI:

```bash
awslocal s3api list-objects --bucket integrated-data-bods-txc-local
```

Insert data into the database for a given file:

```bash
make run-local-bods-txc-processor FILE="20240502/Yeomans_Travel_192/Yeomans_Canyon_Travel_latest_448_Um6tex2.xml"
```

#### Traveline National Dataset (TNDS)

> TNDS data mapping requires NOC, NapTAN and NPTG data to exist in the database first (see relevant sections above).

TNDS data is behind authorisation. First find the AWS ARN of the secret that contains auth credentials:

```bash
aws secretsmanager list-secrets
```

Then copy the `ARN` for the secret called "tnds_ftp".

Download all TNDS data into the localstack container with this ARN:

```bash
run-local-tnds-txc-retriever TNDS_FTP_ARN="{TNDS_FTP_ARN}"
```

TNDS provides multiple archives. The resulting files can be listed using the AWS CLI:

```bash
awslocal s3api list-objects --bucket integrated-data-tnds-txc-zipped-local
```

Unzip a specified archive:

```bash
make run-local-tnds-txc-unzipper FILE=S.zip
```

The resulting files can be listed using the AWS CLI:

```bash
awslocal s3api list-objects --bucket integrated-data-tnds-txc-local
```

Map and insert data into the database for a given file:

```bash
make run-local-tnds-txc-processor FILE="S/S_SC_STWS_X79_2_A.xml"
```

#### Renaming tables

To update the tables within the database you can run:

```bash
make run-local-table-renamer
```

This will update the `_new` tables to be the primary tables and update the primary tables to be `_old`, for example:

```text
trip_new -> trip
trip -> trip_old
trip_old -> <Deleted>
```

### GTFS feed generation

#### GTFS Schedule

> The GTFS is generated by exporting data directly from the Aurora database into an S3 bucket. This functionality can
> not currently be replicated locally
> and so needs to be tested when deployed into AWS.

GTFS generation runs as part of the timetables step function, separate jobs will run to generate the national GTFS file
along with a job for each individual regional file.
These files will be stored in the `integrated-data-gtfs-timetables-{ENV}` bucket with the names `all_gtfs.zip` for the
national file and `${REGION_CODE}_gtfs.zip` for the regions.
For example, the GTFS file for East Anglia will be named `ea_gtfs.zip`.

These files are made available via an API with the endpoint being of the
form `https://gtfs.integrated-data.${ROOT_DOMAIN}/gtfs`, without a query parameter this will download the
national file, by passing `?region=${REGION_CODE}`, individual regional files can be downloaded.

#### GTFS Realtime

> GTFS RT data mapping requires AVL data to exist in the database first (see AVL section above).

The GTFS RT feed is subscription-based, however a snapshot of the feed at the current point in time can be generated:

```bash
make run-local-gtfs-rt-generator
```

The resulting file can be manually downloaded:

```bash
awslocal s3api get-object --bucket integrated-data-gtfs-rt-local --key gtfs-rt.bin local-gtfs-rt.bin
```

### Creating and invoking lambda functions locally

`tflocal` is used to manage lambdas in the local Terraform workspace.
To deploy lambdas after making changes:

```bash
make create-local-env
```

To invoke a lambda locally, use its corresponding CLI helper command as documented in the [CLI Helpers](#cli-helpers)
section below.

Alternatively, invoke the lambda directly (with any necessary env vars):

```bash
ENV_VAR_1="{A}" ENV_VAR_2="{B}" awslocal lambda invoke --function-name {FUNCTION_NAME} --output text /dev/stdout
```

### CLI Helpers

Inside `./cli-helpers` are a number of CLI commands to help with development, such as invoking lambdas and provisioning
mock data.

Run a command by using the command's filename:

```bash
make command-{command-name}

# for example:
make command-invoke-gtfs-rt-downloader

# with flags:
make command-invoke-avl-unsubscriber FLAGS="--stage local"
```

### Manually updating ECS services

After updating the code for an ECS task, a new image needs to be pushed up to the ECR repository.

First build the image:

```bash
make docker-build-{SERVICE_NAME}
```

Then tag the image:

```bash
docker tag {SERVICE_NAME}:latest {ECR_ACCOUNT_ID}.dkr.ecr.eu-west-2.amazonaws.com/{SERVICE_NAME}:latest
```

Authenticate against the ECR repository:

```bash
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin {ECR_ACCOUNT_ID}.dkr.ecr.eu-west-2.amazonaws.com
```

Push the image to the repo:

```bash
docker push {ECR_ACCOUNT_ID}.dkr.ecr.eu-west-2.amazonaws.com/{SERVICE_NAME}:latest
```

## Configuration

### Adding and updating secrets

[SOPS](https://github.com/getsops/sops) is used to handle secrets and configuration for terraform. This uses an AWS KMS
key to encrypt a secrets file which can then be committed into version control.

In order to add or update a secret, first authenticate against the target AWS account (where the required KMS key
resides) and then run the following from the root directory:

```bash
make edit-secrets-{ENV}
```

This will open a text editor so you can edit the secrets file, when you save the changes to the file then SOPS will
automatically encrypt the new file which can then be pushed.

### Using secrets in Terraform

To use a secret from SOPS in terraform, you first need to reference SOPS as a required provider, then reference the
secrets file in a data block. The secrets can then be extracted. An example of this would be:

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

## Testing

Automated testing is configured with [Vitest](https://vitest.dev/).
Configuration includes a CLI test report and a HTML test coverage report.

To run all tests:

```bash
make test-functions
```

To run tests within a specific lambda function:

```bash
cd src/functions/{folder}
pnpm test
```

## Logging

Logs are sent to AWS Cloudwatch. The logger is instantiated in the shared library as either a lambda logger or pino logger,
depending on whether the runtime environment is an AWS lambda.

## CICD

### Workflow

On PR creation:

- Terraform plan generation (saved as a comment to the PR)
- Terraform linting
- Lambda functions linting and unit testing

On PR approval:

- Terraform apply
- Lambda functions build and deploy (only those with changes)

### Environments

| Environment | Notes                                                    |
| ----------- | -------------------------------------------------------- |
| `local`     | Local environment used with localstack                   |
| `dev`       | Deployed environment used for dev testing                |
| `test`      | Deployed environment used for UAT and automation testing |
| `prod`      | Not used yet                                             |

### Deploying changes locally

Deploying manually is possible. First initialise Terraform:

```bash
# replace {ENV} with a known environment
make tf-init-{ENV}
```

Then run a plan and/or apply:

```bash
# replace {ENV} with a known environment
make tf-init-{ENV}
make tf-plan-{ENV}
make tf-apply-{ENV}
```

To deploy lambda functions, first build the functions before applying:

```bash
make install-deps build-functions
make tf-apply-{ENV}
```
