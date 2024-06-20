import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlValidate = new Command("invoke-avl-validate")
    .addOption(STAGE_OPTION)
    .option("--url <url>", "Data producer url")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .action(async (options) => {
        let { stage, url, username, password } = options;

        if (!stage) {
            const responses = await inquirer.prompt<{ stage: string }>([
                {
                    name: "stage",
                    message: "Select the stage",
                    type: "list",
                    choices: STAGES,
                },
            ]);

            stage = responses.stage;
        }

        if (!url) {
            const response = await inquirer.prompt<{ url: string }>([
                {
                    name: "url",
                    message: "Enter the data producer url",
                    type: "input",
                },
            ]);

            url = response.url;
        }

        if (!username) {
            const response = await inquirer.prompt<{ username: string }>([
                {
                    name: "username",
                    message: "Enter the data producer's username",
                    type: "input",
                },
            ]);

            username = response.username;
        }

        if (!password) {
            const response = await inquirer.prompt<{ password: string }>([
                {
                    name: "password",
                    message: "Enter the data producer's password",
                    type: "password",
                },
            ]);

            password = response.password;
        }

        const invokePayload = {
            body: `{\"url\": \"${url}\",\"username\": \"${username}\",\"password\": \"${password}\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-subscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
