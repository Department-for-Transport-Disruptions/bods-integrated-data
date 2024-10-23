import { program } from "commander";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .action(async (options) => {
        const { stage, subscriptionId } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            subscriptionId: { type: "input" },
        });

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

        const payload = {
            headers: {
                "x-api-key": apiKey,
            },
            pathParameters: { subscriptionId },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-datafeed-validator-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(payload),
        });
    })
    .parse();
