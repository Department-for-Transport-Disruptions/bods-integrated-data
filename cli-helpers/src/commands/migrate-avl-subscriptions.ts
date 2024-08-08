import { writeFile } from "node:fs/promises";

import { Command } from "@commander-js/extra-typings";
import csvToJson from "convert-csv-to-json";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda } from "../utils";

interface BodsSubscription {
    dataset_id: string;
    organisation_id: string;
    url_link: string;
    username: string;
    password: string;
    status: string;
    requestor_ref: string | null;
}

interface Subscription {
    id: string;
    publisherId: string;
    url: string;
    username: string;
    password: string;
    requestorRef: string | null;
}

const generateLambdaPayload = (
    producerEndpoint: string,
    username: string,
    password: string,
    subscriptionId: string,
    publisherId: string,
    apiKey: string,
    requestorRef: string | null,
) => {
    return {
        headers: {
            "x-api-key": apiKey,
        },
        body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"Subscription for ${username}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\",\"subscriptionId\": \"${subscriptionId}\",\"publisherId\": \"${publisherId}\",\"requestorRef\": \"${requestorRef}\"}`,
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

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

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
            .getJsonFromCsv(`${fileName}.csv`) as unknown as BodsSubscription[];

        const setOfSubscriptionUrlAndUsername = new Set();
        const dataProducersToSubscribeTo: Subscription[] = [];

        // Firstly, attempt to subscribe to live subscriptions from BODS
        for (const subscription of subscriptionsJson) {
            if (
                !setOfSubscriptionUrlAndUsername.has(`${subscription.url_link}, ${subscription.username}`) &&
                subscription.status === "live"
            ) {
                setOfSubscriptionUrlAndUsername.add(`${subscription.url_link}, ${subscription.username}`);

                dataProducersToSubscribeTo.push({
                    id: subscription.dataset_id,
                    publisherId: subscription.organisation_id,
                    url: subscription.url_link,
                    username: subscription.username,
                    password: subscription.password,
                    requestorRef: subscription.requestor_ref === "" ? null : subscription.requestor_ref,
                });
            }
        }

        // Secondly, attempt to subscribe the subscriptions in an error state from BODS. We do this for any
        // subscriptions not picked up in the "live" loop as they still might be valid subscriptions.
        for (const subscription of subscriptionsJson) {
            if (
                !setOfSubscriptionUrlAndUsername.has(`${subscription.url_link}, ${subscription.username}`) &&
                subscription.status === "error"
            ) {
                setOfSubscriptionUrlAndUsername.add(`${subscription.url_link}, ${subscription.username}`);

                dataProducersToSubscribeTo.push({
                    id: subscription.dataset_id,
                    publisherId: subscription.organisation_id,
                    url: subscription.url_link,
                    username: subscription.username,
                    password: subscription.password,
                    requestorRef: subscription.requestor_ref === "" ? null : subscription.requestor_ref,
                });
            }
        }

        const unsuccessfulSubscriptions: Subscription[] = [];
        const successfulSubscriptions: Subscription[] = [];

        for (const subscription of dataProducersToSubscribeTo) {
            const payload = generateLambdaPayload(
                subscription.url,
                subscription.username,
                subscription.password,
                subscription.id,
                subscription.publisherId,
                apiKey,
                subscription.requestorRef,
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

            const returnPayloadJson = JSON.parse(subscribeEvent.Payload?.transformToString() ?? "{}");

            if (returnPayloadJson.statusCode !== 201) {
                unsuccessfulSubscriptions.push(subscription);
            } else {
                successfulSubscriptions.push(subscription);
            }

            // Enforce a wait time to avoid throttling errors from data producers
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        await writeFile("unsuccessful-subscriptions.json", JSON.stringify(unsuccessfulSubscriptions));
        await writeFile("successful-subscriptions.json", JSON.stringify(successfulSubscriptions));
    });
