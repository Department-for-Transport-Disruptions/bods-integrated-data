import { logger } from "@bods-integrated-data/shared/logger";
import { program } from "commander";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .option("--producerEndpoint <endpoint>", "Data producer endpoint")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .option("--publisherId <publisherId>", "Data producer publisher ID")
    .option("--requestorRef <requestorRef>", "Requestor Ref")
    .action(async (options) => {
        const { stage, producerEndpoint, username, password, subscriptionId, publisherId, requestorRef } =
            await withUserPrompts(options, {
                stage: { type: "list", choices: STAGES },
                producerEndpoint: { type: "input" },
                username: { type: "input" },
                password: { type: "password" },
                subscriptionId: { type: "input" },
                publisherId: { type: "input" },
                requestorRef: { type: "input" },
            });

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"Subscription for ${username}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\",\"subscriptionId\": \"${subscriptionId}\",\"publisherId\": \"${publisherId}\",\"requestorRef\": \"${requestorRef}\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-subscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Subscription request for producer: ${producerEndpoint} sent to subscribe endpoint`);
    })
    .parse();
