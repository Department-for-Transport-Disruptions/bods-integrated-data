import { logger } from "@baselime/lambda-logger";
import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlSubscriber = new Command("invoke-avl-subscriber")
    .addOption(STAGE_OPTION)
    .option("--producerEndpoint <endpoint>", "Data producer endpoint")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .option("--publisherId <publisherId>", "Data producer publisher ID")
    .action(async (options) => {
        let { stage, producerEndpoint, username, password, subscriptionId, publisherId } = options;

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

        const invokePayload = {
            body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"Subscription for ${username}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\",\"subscriptionId\": \"${subscriptionId}\",\"publisherId\": \"${publisherId}\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-subscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Subscription request for producer: ${producerEndpoint} sent to subscribe endpoint`);
    });
