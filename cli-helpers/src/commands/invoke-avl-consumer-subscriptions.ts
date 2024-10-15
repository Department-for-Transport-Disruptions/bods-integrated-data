import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeAvlConsumerSubscriptions = new Command("invoke-avl-consumer-subscriptions")
    .addOption(STAGE_OPTION)
    .option("--userId <userId>", "BODS user ID")
    .option("--subscriptionId <subscriptionId>", "Subscription ID")
    .action(async (options) => {
        const { stage, userId, subscriptionId } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            userId: { type: "input" },
            subscriptionId: { type: "input" },
        });

        const invokePayload = {
            headers: {
                "x-user-id": userId,
            },
            pathParameters: {
                subscriptionId,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-subscriptions-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
