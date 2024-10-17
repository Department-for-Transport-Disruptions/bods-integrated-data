import { Command } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";

export const invokeCancellationsSiriSxDownloader = new Command("invoke-cancellations-siri-sx-downloader")
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .action(async (options) => {
        const { stage, subscriptionId } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            subscriptionId: { type: "input" },
        });

        const invokePayload = {
            queryStringParameters: {
                subscriptionId,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-cancellations-siri-sx-downloader-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
