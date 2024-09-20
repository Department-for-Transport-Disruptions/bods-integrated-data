import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlConsumerSubscriptionTrigger = new Command("invoke-avl-consumer-subscription-trigger")
    .addOption(STAGE_OPTION)
    .option("--subscriptionPK <subscriptionPK>", "Consumer subscription PK")
    .option("--queueUrl <queueUrl>", "Queue URL")
    .option("--frequencyInSeconds <frequencyInSeconds>", "Frequency in seconds")
    .action(async (options) => {
        let { stage, subscriptionPK, queueUrl, frequencyInSeconds } = options;

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
                    type: "input",
                },
            ]);

            frequencyInSeconds = response.frequencyInSeconds;
        }

        const invokePayload = {
            subscriptionPK,
            queueUrl,
            frequencyInSeconds: Number.parseInt(frequencyInSeconds),
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-subscription-trigger-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
