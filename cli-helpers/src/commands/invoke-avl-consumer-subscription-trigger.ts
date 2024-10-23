import { Command, Option } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

const frequencyChoices = ["10", "15", "20", "30"];

export const invokeAvlConsumerSubscriptionTrigger = new Command("invoke-avl-consumer-subscription-trigger")
    .addOption(STAGE_OPTION)
    .option("--apiKey <apiKey>", "API key")
    .option("--subscriptionPK <subscriptionPK>", "Consumer subscription PK")
    .option("--queueUrl <queueUrl>", "Queue URL")
    .addOption(
        new Option("--frequencyInSeconds <frequencyInSeconds>", "Frequency in seconds").choices(frequencyChoices),
    )
    .action(async (options) => {
        const { stage, apiKey, subscriptionPK, queueUrl, frequencyInSeconds } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            apiKey: { type: "input" },
            subscriptionPK: { type: "input" },
            queueUrl: { type: "input" },
            frequencyInSeconds: { type: "list", choices: frequencyChoices },
        });

        const invokePayload = {
            subscriptionPK,
            SK: apiKey,
            queueUrl,
            frequencyInSeconds: Number.parseInt(frequencyInSeconds),
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-subscription-trigger-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
