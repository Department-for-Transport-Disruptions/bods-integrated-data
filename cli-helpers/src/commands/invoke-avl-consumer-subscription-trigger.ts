import { Command, Option } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlConsumerSubscriptionTrigger = new Command("invoke-avl-consumer-subscription-trigger")
    .addOption(STAGE_OPTION)
    .option("--subscriptionPK <subscriptionPK>", "Consumer subscription PK")
    .option("--userId <userId>", "BODS user ID")
    .option("--queueUrl <queueUrl>", "Queue URL")
    .addOption(
        new Option("--frequencyInSeconds <frequencyInSeconds>", "Frequency in seconds").choices([
            "10",
            "15",
            "20",
            "30",
        ]),
    )
    .action(async (options) => {
        let { stage, subscriptionPK, userId, queueUrl, frequencyInSeconds } = options;

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
                    message: "Enter the consumer subscription PK",
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

        if (!queueUrl) {
            const response = await inquirer.prompt<{ queueUrl: string }>([
                {
                    name: "queueUrl",
                    message: "Enter the queue URL",
                    type: "input",
                },
            ]);

            queueUrl = response.queueUrl;
        }

        if (!frequencyInSeconds) {
            const response = await inquirer.prompt<{ frequencyInSeconds: string }>([
                {
                    name: "frequencyInSeconds",
                    message: "Enter the frequency in seconds",
                    type: "list",
                    choices: ["10", "15", "20", "30"],
                },
            ]);

            frequencyInSeconds = response.frequencyInSeconds;
        }

        const invokePayload = {
            subscriptionPK,
            SK: userId,
            queueUrl,
            frequencyInSeconds: Number.parseInt(frequencyInSeconds),
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-subscription-trigger-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
