import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";
import { Uint8ArrayBlobAdapter } from "@smithy/util-stream";
import { writeFile } from "node:fs/promises";
import * as fs from "node:fs";

interface Subscription {
    id: string;
    publisherId: string;
    url: string;
    username: string;
    password: string;
}

const getInvokePayload = (subscriptionId: string) => ({
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

        const data = await fs.promises.readFile("./successful-subscriptions.json", "utf-8");
        const subscriptions: Subscription[] = JSON.parse(data);

        const unsuccessfulSubscriptions: Subscription[] = [];

        for (const subscription of subscriptions) {
            const invokePayload = getInvokePayload(subscription.id);

            const unsubscribeEvent = await invokeLambda(stage, {
                FunctionName: `integrated-data-avl-unsubscriber-${stage}`,
                InvocationType: "RequestResponse",
                Payload: JSON.stringify(invokePayload),
            });

            if (!unsubscribeEvent || !unsubscribeEvent.Payload) {
                unsuccessfulSubscriptions.push(subscription);
                return;
            }

            const returnPayload: Uint8ArrayBlobAdapter = unsubscribeEvent.Payload;

            const returnPayloadJson = JSON.parse(returnPayload?.transformToString() ?? "{}");

            if (returnPayloadJson.statusCode !== 204) {
                unsuccessfulSubscriptions.push(subscription);
                return;
            }
        }

        await writeFile("unsubscribe-unsuccessful-subscriptions.json", JSON.stringify(unsuccessfulSubscriptions));
    });
