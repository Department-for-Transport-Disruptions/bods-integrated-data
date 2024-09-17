import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlConsumerDataSender = new Command("invoke-avl-consumer-data-sender")
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <subscriptionId>", "Consumer subscription ID")
    .option("--userId <userId>", "User ID")
    .action(async (options) => {
        let { stage, subscriptionId, userId } = options;

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
                    message: "Enter the subscription ID",
                    type: "input",
                },
            ]);

            subscriptionId = response.subscriptionId;
        }

        if (!userId) {
            const response = await inquirer.prompt<{ userId: string }>([
                {
                    name: "userId",
                    message: "Enter the user ID",
                    type: "input",
                },
            ]);

            userId = response.userId;
        }

        const invokePayload = {
            subscriptionId,
            userId,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-data-sender-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
