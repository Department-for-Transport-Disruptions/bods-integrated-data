import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlConsumerDataSender = new Command("invoke-avl-consumer-data-sender")
    .addOption(STAGE_OPTION)
    .option("--subscriptionPK <subscriptionPK>", "Consumer subscription PK")
    .option("--userId <userId>", "BODS user ID")
    .action(async (options) => {
        let { stage, subscriptionPK, userId } = options;

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

        if (!subscriptionPK) {
            const response = await inquirer.prompt<{ subscriptionPK: string }>([
                {
                    name: "subscriptionPK",
                    message: "Enter the subscription PK",
                    type: "input",
                },
            ]);

            subscriptionPK = response.subscriptionPK;
        }

        if (!userId) {
            const response = await inquirer.prompt<{ userId: string }>([
                {
                    name: "userId",
                    message: "Enter the BODS user ID",
                    type: "input",
                },
            ]);

            userId = response.userId;
        }

        const invokePayload = {
            Records: [
                {
                    body: JSON.stringify({ subscriptionPK, SK: userId }),
                },
            ],
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-data-sender-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
