import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeAvlConsumerDataSender = new Command("invoke-avl-consumer-data-sender")
    .addOption(STAGE_OPTION)
    .option("--apiKey <apiKey>", "API key")
    .option("--subscriptionPK <subscriptionPK>", "Consumer subscription PK")
    .action(async (options) => {
        const { stage, apiKey, subscriptionPK } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            apiKey: { type: "input" },
            subscriptionPK: { type: "input" },
        });

        const invokePayload = {
            Records: [
                {
                    body: JSON.stringify({ subscriptionPK, SK: apiKey }),
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-data-sender-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
