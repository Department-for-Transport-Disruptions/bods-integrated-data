import { logger } from "@bods-integrated-data/shared/logger";
import { program } from "commander";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .option("--producerEndpoint <endpoint>", "Data producer endpoint")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .option("-d, --description <description>", "Data producer description")
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .action(async (options) => {
        const { stage, producerEndpoint, username, password, subscriptionId, description } = await withUserPrompts(
            options,
            {
                stage: { type: "list", choices: STAGES },
                producerEndpoint: { type: "input" },
                username: { type: "input" },
                password: { type: "password" },
                subscriptionId: { type: "input" },
                description: { type: "input" },
            },
        );

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

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
    })
    .parse();
