import { program } from "commander";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda, withUserPrompts } from "../utils";
program
    .option("--subscriptionId <subscriptionId>", "Subscription ID")
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage, subscriptionId } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            subscriptionId: { type: "input" },
        });

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

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
    })
    .parse();
