import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlMockDataReceiver = new Command("invoke-avl-mock-data-receiver")
    .addOption(STAGE_OPTION)
    .option("--body <body>", "Request body")
    .action(async (options) => {
        let { stage, body } = options;

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

        if (!body) {
            const response = await inquirer.prompt<{ body: string }>([
                {
                    name: "body",
                    message: "Enter the request body",
                    type: "input",
                },
            ]);

            body = response.body;
        }

        const invokePayload = {
            body,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-mock-data-receiver-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
