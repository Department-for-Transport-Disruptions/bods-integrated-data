# Typescript Lambda Template

This template can be used when creating a new typescript lambda and contains the basic config files needed to get up and
running. 

When using this template make sure to complete the following actions:

### Update the build scripts in the `package.json` file

After copying the lambda-template directory and renaming it to your function name, replace `lamda-template.zip` with
`{YOUR_FUNCTION_DIRECTORY_NAME}.zip` for the `build:ci` and `build:local` scripts.

```JSON
"scripts": {
        "build:ci": "rm -rf ./dist && tsc && node ./esbuild.mjs && cd ./dist && zip -rq ./lambda-template.zip .",
        "build:local": "pnpm run build:ci && mkdir -p ../dist && cp ./dist/lambda-template.zip ../dist",
        "test": "vitest run"
},
```

### Create a `Makefile` command

To make it easy to test the lambda function locally create a make command. It should follow a similar structure to
the below command:

```makefile
run-lambda-template:
    IS_LOCAL=true npx tsx -e "import {handler} from './src/functions/lambda-template'; handler().catch(e => console.error(e))"
```

Replace `lambda-template` with the name of your new function's directory. `IS_LOCAL=true` is an example of how to pass 
an environment variable to the lambda. 

Before testing your lambda locally run the following commands from the root directory to install dependencies:
```bash
cd src
pnpm i
```