import { logger } from "@baselime/lambda-logger";
import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlUnsubscriber = new Command("invoke-avl-unsubscriber")
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <id>", "Subscription ID of the data producer")
    .action(async (options) => {
        let { stage, subscriptionId } = options;

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
            const responses = await inquirer.prompt<{ subscriptionId: string }>([
                {
                    name: "subscriptionId",
                    message: "Enter the subscription ID of the data producer",
                    type: "input",
                },
            ]);

            subscriptionId = responses.subscriptionId;
        }

        const invokePayload = {
            pathParameters: {
                subscription_id: subscriptionId,
            },
            queryStringParameters: {
                subscription_id: subscriptionId,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-unsubscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Unsubscribe request sent for subscription ID: ${subscriptionId}.`);
    });
