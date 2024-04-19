import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Command, Flags } from "@oclif/core";
import inquirer from "inquirer";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

export default class InvokeAvlSubscriber extends Command {
    static description = "Invoke AVL data endpoint";

    static flags = {
        stage: Flags.string({ description: "Stage to use" }),
        subscriptionId: Flags.string({ description: "Subscription ID of the data producer to unsubscribe from" }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(InvokeAvlSubscriber);

        let { stage, subscriptionId } = flags;

        if (!stage) {
            const responses = await inquirer.prompt<{ stage: string }>([
                {
                    name: "stage",
                    message: "Select the stage",
                    type: "list",
                    choices: ["local", "dev"],
                },
            ]);

            stage = responses.stage;
        }

        if (!subscriptionId) {
            const responses = await inquirer.prompt<{ subscriptionId: string }>([
                {
                    name: "subscriptionId",
                    message: "Enter the subscription ID of the data producer",
                    type: "input",
                },
            ]);

            subscriptionId = responses.subscriptionId;
        }

        const lambdaClient = new LambdaClient({
            region: "eu-west-2",
            ...(stage === "local"
                ? {
                      endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
                      credentials: {
                          accessKeyId: "DUMMY",
                          secretAccessKey: "DUMMY",
                      },
                  }
                : {}),
        });

        const invokePayload = {
            pathParameters: {
                subscription_id: subscriptionId,
            },
            queryStringParameters: {
                subscription_id: subscriptionId,
            },
        };

        await lambdaClient.send(
            new InvokeCommand({
                FunctionName: `avl-unsubscriber-${stage}`,
                InvocationType: "Event",
                Payload: JSON.stringify(invokePayload),
            }),
        );

        // eslint-disable-next-line no-console
        console.log(`Unsubscribe request sent for subscription ID: ${subscriptionId}.`);
    }
}
