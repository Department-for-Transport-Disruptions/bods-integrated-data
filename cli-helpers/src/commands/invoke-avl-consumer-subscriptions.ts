import { program } from "commander";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .option("--apiKey <apiKey>", "API key")
    .option("--subscriptionId <subscriptionId>", "Subscription ID")
    .action(async (options) => {
        const { stage, apiKey, subscriptionId } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            apiKey: { type: "input" },
            subscriptionId: { type: "input" },
        });

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            queryStringParameters: {
                subscriptionId,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-subscriptions-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    })
    .parse();
