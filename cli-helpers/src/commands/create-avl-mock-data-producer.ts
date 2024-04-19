import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGE_OPTION, invokeLambda } from "../utils";

export default new Command("create-avl-mock-data-producer")
    .addOption(STAGE_OPTION)
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
            FunctionName: `avl-subscriber-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(invokePayload),
        });

        console.log(`Mock AVL data producer created, name: ${cleanName}`);
    });
