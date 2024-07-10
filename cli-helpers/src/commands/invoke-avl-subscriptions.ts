import { Command } from "@commander-js/extra-typings";
import { STAGE_OPTION_WITH_DEFAULT, getSecretByKey, invokeLambda } from "../utils";

export const invokeAvlSubscriptions = new Command("invoke-avl-subscriptions")
    .option("--subscriptionId <subscriptionId>", "Subscription ID")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .action(async (options) => {
        const { stage, subscriptionId } = options;
        const apiKey = await getSecretByKey("avl_producer_api_key");

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
