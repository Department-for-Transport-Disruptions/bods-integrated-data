import { Command } from "@commander-js/extra-typings";
import { invokeLambda, STAGE_OPTION, STAGES } from "../utils";
import inquirer from "inquirer";
import csvToJson from "convert-csv-to-json";
import { writeFile } from "node:fs/promises";
import { Uint8ArrayBlobAdapter } from "@smithy/util-stream";

interface Subscription {
    id: string;
    publisherId: string;
    url: string;
    username: string;
    password: string;
}

const generateLambdaPayload = (
    producerEndpoint: string,
    username: string,
    password: string,
    subscriptionId: string,
    publisherId: string,
) => {
    return {
        body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"Subscription for ${username}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\",\"subscriptionId\": \"${subscriptionId}\",\"publisherId\": \"${publisherId}\"}`,
    };
};

export const migrateAvlSubscriptions = new Command("migrate-avl-subscriptions")
    .addOption(STAGE_OPTION)
    .option("--fileName <fileName>", "Subscriptions CSV file name")
    .action(async (options) => {
        let { stage, fileName } = options;

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

        if (!fileName) {
            const responses = await inquirer.prompt<{ fileName: string }>([
                {
                    name: "fileName",
                    message: "Enter the file name for the subscriptions CSV file",
                    type: "input",
                },
            ]);

            fileName = responses.fileName;
        }

        const subscriptionsJson = csvToJson
            .fieldDelimiter(",")
            .getJsonFromCsv(`${fileName}.csv`) as unknown as Subscription[];

        const unsuccessfulSubscriptions = [];

        for (const subscription of subscriptionsJson) {
            const payload = generateLambdaPayload(
                subscription.url,
                subscription.username,
                subscription.password,
                subscription.id,
                subscription.publisherId,
            );

            const subscribeEvent = await invokeLambda(stage, {
                FunctionName: `integrated-data-avl-subscriber-${stage}`,
                InvocationType: "RequestResponse",
                Payload: JSON.stringify(payload),
            });

            if (!subscribeEvent || !subscribeEvent.Payload) {
                unsuccessfulSubscriptions.push(subscription);
                return;
            }

            const returnPayload: Uint8ArrayBlobAdapter = subscribeEvent.Payload;

            const returnPayloadJson = JSON.parse(returnPayload?.transformToString() ?? "{}");

            if (returnPayloadJson.statusCode !== 201) {
                unsuccessfulSubscriptions.push(subscription);
            }
        }

        await writeFile("unsuccessful-subscriptions.json", JSON.stringify(unsuccessfulSubscriptions));
    });
