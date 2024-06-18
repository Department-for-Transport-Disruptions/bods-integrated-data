# Typescript Lambda Template

This template can be used when creating a new typescript lambda and contains the basic config files needed to get up and
running.

When using this template make sure to complete the following actions:

- [Update `package.json`](#update-packagejson)
- [Create a `Makefile` command](#create-a-makefile-command)
- [Create a CLI Helper](#create-a-cli-helper)
- [Update Terraform resources](#update-terraform-resources)
  - [Allowing lambda to connect to the database](#allowing-lambda-to-connect-to-the-database)
- [Remove this README](#remove-this-readme)

## Update `package.json`

After copying the lambda-template directory and renaming it to your function name update the following in your `package.json`:

- Update name to your function's name
- Update description to describe what your function is doing
- Update `lamda-template.zip` with `{YOUR_FUNCTION_DIRECTORY_NAME}.zip` for the `build:ci` and `build:local` scripts.

```JSON
"name": "@bods-integrated-data/lambda-template",
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
run-lambda-template:
  STAGE=local npx tsx -e "import {handler} from './src/functions/lambda-template'; handler().then(console.log).catch(console.error)"
```

Replace `lambda-template` with the name of your new function's directory. `STAGE=local` is an example of how to pass an environment variable to the lambda.

Before testing your lambda locally run the following commands from the root directory to install dependencies:

```bash
cd src
pnpm i
```

## Create a CLI Helper

In `cli-helpers/src/commands` create a `invoke-lambda-template.ts` file with the following contents, replacing `lambda-template` in the file name with the
function name, as well as `lambda-template` and `LambdaTemplate` in the file:

```typescript
import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeLambdaTemplate = new Command("invoke-lambda-template")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage } = options;

        await invokeLambda(stage, {
            FunctionName: `integrated-data-lambda-template-${stage}`,
            InvocationType: "RequestResponse",
        });
    });
```

Add any extra configuration to the file as necessary.

Finally, export the CLI-helper in the `cli-helpers/src/commands/index.ts` file:

```typescript
// ...other exports
export * from "./invoke-lambda-template";
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
    STAGE = var.environment
  }
}
```

Make sure to include any extra env vars as variables in the module and in the relevant `variables.tf` file:

```yaml
  env_vars = {
    # ...other env vars
  }
```

Ensure to reference the new module in the `main.tf` files for each env workspace (dev, local, test, prod etc.), for example:

```yaml
module "integrated_lambda_template" {
  source = "../modules/lambda-template"

  environment = local.env
}
```

### Allowing lambda to connect to the database

In order for the lambda function to connect to the database, it needs to be set up as a VPC lambda, this can be achieved by passing through the following properties:

```yaml
needs_db_access = var.environment != "local"
vpc_id          = var.vpc_id
subnet_ids      = var.private_subnet_ids
database_sg_id  = var.db_sg_id
```

where the required values should be passed through as variables from the top-level.

The lambda will also require permission to access the db credentials in secrets manager, this can be achieved by adding the following permission:

```yaml
permissions = [
# ...other permissions
{
  Action = [
    "secretsmanager:GetSecretValue",
  ],
  Effect = "Allow",
  Resource = [
    var.db_secret_arn
  ]
}
]
```

Finally, it will also require the following env vars to be passed to the function alongside any other required variables:

```yaml
env_vars = {
  # ...other env vars
  DB_HOST       = var.db_host
  DB_PORT       = var.db_port
  DB_SECRET_ARN = var.db_secret_arn
  DB_NAME       = var.db_name
}
```

## Remove this README

Finally, remove this readme, or replace its contents with suitable readme instructions for the lambda function.
