import { logger } from "@bods-integrated-data/shared/logger";
import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlUpdateEndpoint = new Command("invoke-avl-update-endpoint")
    .addOption(STAGE_OPTION)
    .option("--producerEndpoint <endpoint>", "Data producer endpoint")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .option("-d, --description <description>", "Data producer description")
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .option("--apiKey <apiKey>", "Pass apiKey parameter to function")
    .action(async (options) => {
        let { stage, producerEndpoint, username, password, subscriptionId, description, apiKey } = options;

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

        if (!description) {
            const response = await inquirer.prompt<{ description: string | undefined }>([
                {
                    name: "description",
                    message: "Enter the data producer's description (optional)",
                    type: "input",
                },
            ]);

            description = response.description ?? `Subscription for ${username}`;
        }

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"${description}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\",\"subscriptionId\": \"${subscriptionId}\"}`,
            pathParameters: {
                subscriptionId: subscriptionId,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-update-endpoint-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Update subscription request for producer: ${producerEndpoint} sent to update endpoint`);
    });
