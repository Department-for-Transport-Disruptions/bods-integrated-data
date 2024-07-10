import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const invokeAvlSubscriptions = new Command("invoke-avl-subscriptions")
    .option("--subscriptionId <subscriptionId>", "Subscription ID")
    .option("--apiKey <apiKey>", "Pass apiKey parameter to function")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage, subscriptionId, apiKey } = options;

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            pathParameters: {
                subscriptionId,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-subscriptions-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
