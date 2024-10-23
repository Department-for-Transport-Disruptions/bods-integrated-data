import { readFile, writeFile } from "node:fs/promises";
import { program } from "commander";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda, withUserPrompts } from "../utils";
interface Subscription {
    id: string;
    publisherId: string;
    url: string;
    username: string;
    password: string;
}

program
    .addOption(STAGE_OPTION)
    .action(async (options) => {
        const { stage } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
        });

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");
        const data = await readFile("./successful-subscriptions.json", "utf-8");
        const subscriptions: Subscription[] = JSON.parse(data);

        const unsuccessfulSubscriptions: Subscription[] = [];

        for (const subscription of subscriptions) {
            const invokePayload = {
                headers: {
                    "x-api-key": apiKey,
                },
                pathParameters: {
                    subscriptionId: subscription.id,
                },
                queryStringParameters: {
                    subscriptionId: subscription.id,
                },
            };

            const unsubscribeEvent = await invokeLambda(stage, {
                FunctionName: `integrated-data-avl-unsubscriber-${stage}`,
                InvocationType: "RequestResponse",
                Payload: JSON.stringify(invokePayload),
            });

            if (!unsubscribeEvent || !unsubscribeEvent.Payload) {
                unsuccessfulSubscriptions.push(subscription);
                return;
            }

            const returnPayloadJson = JSON.parse(unsubscribeEvent.Payload?.transformToString() ?? "{}");

            if (returnPayloadJson.statusCode !== 204) {
                unsuccessfulSubscriptions.push(subscription);
            }

            // Enforce a wait time to avoid throttling errors from data producers
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        await writeFile("unsubscribe-unsuccessful-subscriptions.json", JSON.stringify(unsuccessfulSubscriptions));
    })
    .parse();
