# Typescript Lambda Template

This template can be used when creating a new typescript lambda and contains the basic config files needed to get up and
running.

When using this template make sure to complete the following actions:

## Update the `package.json` file

After copying the lambda-template directory and renaming it to your function name update the following in your `package.json`:

- Update name to your function's name
- Update description to describe what your function is doing
- Update `lamda-template.zip` with `{YOUR_FUNCTION_DIRECTORY_NAME}.zip` for the `build:ci` and `build:local` scripts.

```JSON
"name": "@bods-integrated-data/lambda-template",
    "version": "0.1.0",
    "description": "Template for a typescript lambda",
    "scripts": {
        "build:ci": "rm -rf ./dist && tsc && node ./esbuild.mjs && cd ./dist && zip -rq ./lambda-template.zip .",
        "build:local": "pnpm run build:ci && mkdir -p ../dist && cp ./dist/lambda-template.zip ../dist",
        "test": "vitest run"
    },
```

## Create a `Makefile` command

To make it easy to test the lambda function locally create a make command. You can follow a similar structure to
the below command:

```makefile
run-lambda-template: STAGE=local npx tsx -e "import {handler} from './src/functions/lambda-template'; handler().catch(e => console.error(e))"
```

Replace `lambda-template` with the name of your new function's directory. `STAGE=local` is an example of how to pass an environment variable to the lambda.

Before testing your lambda locally run the following commands from the root directory to install dependencies:

```bash
cd src
pnpm i
```

## Update Terraform resources

Create a Terraform module for the function, replacing `lambda-template` and `lambda_template` with the function name, using the correct `-` or `_`:

```yaml
module "integrated_data_lambda_template_function" {
  source = "../../shared/lambda-function"

  environment   = var.environment
  function_name = "integrated-data-lambda-template"
  zip_path      = "${path.module}/../../../../src/functions/dist/lambda-template.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory        = 512

  env_vars = {
    STAGE         = var.environment
  }
}
```

Make sure to include any extra env vars as variables in the module and in the relevant `variables.tf` file.
If the function connects to the database, include the DB env vars:

```yaml
  env_vars = {
    # ...other env vars
    DB_HOST       = var.db_host
    DB_PORT       = var.db_port
    DB_SECRET_ARN = var.db_secret_arn
    DB_NAME       = var.db_name
  }
```

Ensure to reference the new module in the `main.tf` files for each env workspace (dev, local, test, prod etc.), for example:

```yaml
module "integrated_lambda_template" {
  source = "../modules/lambda-template"

  environment = local.env
}
```

## Remove this README

Finally, remove this readme, or replace its contents with suitable readme instructions for the lambda function.
