import { logger } from "@bods-integrated-data/shared/logger";
import { program } from "commander";
import { STAGES, STAGE_OPTION, getSecretByKey, invokeLambda, withUserPrompts } from "../utils";

program
    .addOption(STAGE_OPTION)
    .option("-n, --name <name>", "Name of mock data producer")
    .option("--subscriptionId <subscriptionId>", "Data producer subscription ID")
    .action(async (options) => {
        const { stage, name, subscriptionId } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            name: { type: "input" },
            subscriptionId: { type: "input" },
        });

        const apiKey = await getSecretByKey(stage, "avl_producer_api_key");

        const cleanName = name.replace(/\s+/g, "-");
        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            body: `{\"dataProducerEndpoint\": \"https://www.${cleanName}.com\",\"description\": \"Mock AVL producer - ${name}\",\"shortDescription\": \"shortDescription\",\"username\": \"test-username\",\"password\": \"test-password\",\"requestorRef\": \"BODS_MOCK_PRODUCER\",\"subscriptionId\": \"${subscriptionId}\",\"publisherId\": \"bods-mock-producer\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-subscriber-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Mock AVL data producer created, name: ${cleanName}`);
    })
    .parse();
