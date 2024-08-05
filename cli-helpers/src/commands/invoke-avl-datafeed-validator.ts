import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION_WITH_DEFAULT, getSecretByKey, invokeLambda } from "../utils";

export const invokeAvlDataFeedValidator = new Command("invoke-avl-data-feed-validator")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .action(async (options) => {
        let { stage, subscriptionId } = options;
        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

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

        if (!subscriptionId) {
            const response = await inquirer.prompt<{ subscriptionId: string }>([
                {
                    name: "subscriptionId",
                    message: "Enter the data producer's subscriptionId",
                    type: "input",
                },
            ]);

            subscriptionId = response.subscriptionId;
        }

        const payload = {
            headers: {
                "x-api-key": apiKey,
            },
            pathParameters: { subscriptionId: `${subscriptionId}` },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-datafeed-validator-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    });
