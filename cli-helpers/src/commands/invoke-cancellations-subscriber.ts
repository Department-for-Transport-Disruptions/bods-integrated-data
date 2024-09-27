import { logger } from "@bods-integrated-data/shared/logger";
import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda } from "../utils";

export const invokeCancellationsSubscriber = new Command("invoke-cancellations-subscriber")
    .addOption(STAGE_OPTION)
    .option("--producerEndpoint <endpoint>", "Data producer endpoint")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .option("--publisherId <publisherId>", "Data producer publisher ID")
    .option("--requestorRef <requestorRef>", "Requestor Ref")
    .action(async (options) => {
        let { stage, producerEndpoint, username, password, subscriptionId, publisherId, requestorRef } = options;

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

        const apiKey = await getSecretByKey(stage, "cancellations_producer_api_key");

        if (!producerEndpoint) {
            const response = await inquirer.prompt<{ producerEndpoint: string }>([
                {
                    name: "producerEndpoint",
                    message: "Enter the data producer endpoint",
                    type: "input",
                },
            ]);

            producerEndpoint = response.producerEndpoint;
        }

        if (!username) {
            const response = await inquirer.prompt<{ username: string }>([
                {
                    name: "username",
                    message: "Enter the data producer's username",
                    type: "input",
                },
            ]);

            username = response.username;
        }

        if (!password) {
            const response = await inquirer.prompt<{ password: string }>([
                {
                    name: "password",
                    message: "Enter the data producer's password",
                    type: "password",
                },
            ]);

            password = response.password;
        }

        if (!subscriptionId) {
            const response = await inquirer.prompt<{ subscriptionId: string }>([
                {
                    name: "subscriptionId",
                    message: "Enter the data producer's subscriptionId",
                    type: "input",
                },
            ]);

            subscriptionId = response.subscriptionId;
        }

        if (!publisherId) {
            const response = await inquirer.prompt<{ publisherId: string }>([
                {
                    name: "publisherId",
                    message: "Enter the data producer's publisherId",
                    type: "input",
                },
            ]);

            publisherId = response.publisherId;
        }

        if (!requestorRef) {
            const response = await inquirer.prompt<{ requestorRef: string }>([
                {
                    name: "requestorRef",
                    message: "Enter the requestorRef",
                    type: "input",
                    default: "BODS",
                },
            ]);

            requestorRef = response.requestorRef;
        }

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"Subscription for ${username}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\",\"subscriptionId\": \"${subscriptionId}\",\"publisherId\": \"${publisherId}\",\"requestorRef\": \"${requestorRef}\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-cancellations-subscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Subscription request for producer: ${producerEndpoint} sent to subscribe endpoint`);
    });
