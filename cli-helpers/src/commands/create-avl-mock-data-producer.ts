import { logger } from "@baselime/lambda-logger";
import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGE_OPTION_WITH_DEFAULT, invokeLambda } from "../utils";

export const createAvlMockDataProducer = new Command("create-avl-mock-data-producer")
    .addOption(STAGE_OPTION_WITH_DEFAULT)
    .option("-n, --name <name>", "Name of mock data producer")
    .action(async (options) => {
        const { stage } = options;
        let { name } = options;

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

        const cleanName = name.replace(/\s+/g, "-");
        const invokePayload = {
            body: `{\"dataProducerEndpoint\": \"https://www.${cleanName}.com\",\"description\": \"Mock AVL producer - ${name}\",\"shortDescription\": \"shortDescription\",\"username\": \"test-username\",\"password\": \"test-password\",\"requestorRef\": \"BODS_MOCK_PRODUCER\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-subscriber-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`Mock AVL data producer created, name: ${cleanName}`);
    });
