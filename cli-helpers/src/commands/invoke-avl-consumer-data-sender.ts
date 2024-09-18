import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlConsumerDataSender = new Command("invoke-avl-consumer-data-sender")
    .addOption(STAGE_OPTION)
    .option("--PK <PK>", "Consumer subscription PK")
    .action(async (options) => {
        let { stage, PK } = options;

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

        if (!PK) {
            const response = await inquirer.prompt<{ PK: string }>([
                {
                    name: "PK",
                    message: "Enter the subscription PK",
                    type: "input",
                },
            ]);

            PK = response.PK;
        }

        const invokePayload = {
            Records: [
                {
                    body: JSON.stringify({ PK }),
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-data-sender-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
