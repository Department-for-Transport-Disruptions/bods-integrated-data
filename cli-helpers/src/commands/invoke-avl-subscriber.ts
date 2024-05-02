import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlSubscriber = new Command("invoke-avl-subscriber")
    .addOption(STAGE_OPTION)
    .option("--producerEndpoint <endpoint>", "Data producer endpoint")
    .option("-u, --username <username>", "Data producer username")
    .option("-p, --password <password>", "Data producer password")
    .action(async (options) => {
        let { stage, producerEndpoint, username, password } = options;

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
            const responses = await inquirer.prompt<{ producerEndpoint: string }>([
                {
                    name: "producerEndpoint",
                    message: "Enter the data producer endpoint",
                    type: "input",
                },
            ]);

            producerEndpoint = responses.producerEndpoint;
        }

        if (!username) {
            const responses = await inquirer.prompt<{ username: string }>([
                {
                    name: "username",
                    message: "Enter the data producer's username",
                    type: "input",
                },
            ]);

            username = responses.username;
        }

        if (!password) {
            const responses = await inquirer.prompt<{ password: string }>([
                {
                    name: "password",
                    message: "Enter the data producer's password",
                    type: "password",
                },
            ]);

            password = responses.password;
        }

        const invokePayload = {
            body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"Subscription for ${producerEndpoint}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\"}`,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-subscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        console.log(`Subscription request for producer: ${producerEndpoint} sent to subscribe endpoint`);
    });
