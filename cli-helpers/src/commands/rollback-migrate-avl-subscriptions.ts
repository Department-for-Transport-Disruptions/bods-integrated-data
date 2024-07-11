import * as fs from "node:fs";
import { writeFile } from "node:fs/promises";

import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda } from "../utils";

interface Subscription {
    id: string;
    publisherId: string;
    url: string;
    username: string;
    password: string;
}

const getInvokePayload = (subscriptionId: string, apiKey: string) => ({
    headers: {
        "x-api-key": apiKey,
    },
    pathParameters: {
        subscriptionId,
    },
    queryStringParameters: {
        subscriptionId,
    },
});

export const rollbackMigrateAvlSubscriptions = new Command("rollback-migrate-avl-subscriptions")
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <id>", "Subscription ID of the data producer")
    .action(async (options) => {
        let { stage } = options;

        if (!stage) {
            const responses = await inquirer.prompt<{ stage: string }>([
                {
                    name: "stage",
                    message: "Select the stage",
                    type: "list",
                    choices: STAGES,
                },
            ]);

            stage = responses.stage;
        }

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");
        const data = await fs.promises.readFile("./successful-subscriptions.json", "utf-8");
        const subscriptions: Subscription[] = JSON.parse(data);

        const unsuccessfulSubscriptions: Subscription[] = [];

        for (const subscription of subscriptions) {
            const invokePayload = getInvokePayload(subscription.id, apiKey);

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
                return;
            }
        }

        await writeFile("unsubscribe-unsuccessful-subscriptions.json", JSON.stringify(unsuccessfulSubscriptions));
    });
