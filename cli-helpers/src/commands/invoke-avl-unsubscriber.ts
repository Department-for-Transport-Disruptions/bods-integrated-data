import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlUnsubscriber = new Command("invoke-avl-unsubscriber")
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <id>", "Subscription ID of the data producer")
    .action(async (options) => {
        const { stage } = options;
        let { subscriptionId } = options;

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
            FunctionName: `avl-unsubscriber-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(invokePayload),
        });

        console.log(`Unsubscribe request sent for subscription ID: ${subscriptionId}.`);
    });
