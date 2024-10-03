import { logger } from "@bods-integrated-data/shared/logger";
import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda } from "../utils";

export const createCancellationsMockDataProducer = new Command("create-cancellations-mock-data-producer")
    .addOption(STAGE_OPTION)
    .option("-n, --name <name>", "Name of mock data producer")
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .action(async (options) => {
        let { stage, name, subscriptionId } = options;

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

        if (!name) {
            const response = await inquirer.prompt<{ name: string }>([
                {
                    name: "name",
                    message: "Name of mock producer",
                    type: "input",
                },
            ]);

            name = response.name;
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

        const cleanName = name.replace(/\s+/g, "-");
        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            body: `{\"dataProducerEndpoint\": \"https://www.${cleanName}.com\",\"description\": \"Mock AVL producer - ${name}\",\"shortDescription\": \"shortDescription\",\"username\": \"test-username\",\"password\": \"test-password\",\"requestorRef\": \"BODS_MOCK_PRODUCER\",\"subscriptionId\": \"${subscriptionId}\",\"publisherId\": \"bods-mock-producer\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-cancellations-subscriber-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Mock cancellations data producer created, name: ${cleanName}`);
    });
