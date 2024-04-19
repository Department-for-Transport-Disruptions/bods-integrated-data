import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Command, Flags } from "@oclif/core";
import inquirer from "inquirer";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

export default class InvokeAvlSubscriber extends Command {
    static description = "Invoke AVL data endpoint";

    static flags = {
        stage: Flags.string({ description: "Stage to use" }),
        producerEndpoint: Flags.string({ description: "Data producer endpoint" }),
        username: Flags.string({ description: "Data producer username" }),
        password: Flags.string({ description: "Data producer password" }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(InvokeAvlSubscriber);

        let { stage, producerEndpoint, username, password } = flags;

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
            body: `{\"dataProducerEndpoint\": \"${producerEndpoint}\",\"description\": \"Subscription for ${producerEndpoint}\",\"shortDescription\": \"Subscription for ${producerEndpoint}\",\"username\": \"${username}\",\"password\": \"${password}\"}`,
        };

        await lambdaClient.send(
            new InvokeCommand({
                FunctionName: `avl-subscriber-${stage}`,
                InvocationType: "Event",
                Payload: JSON.stringify(invokePayload),
            }),
        );

        // eslint-disable-next-line no-console
        console.log(`Subscription request for producer: ${producerEndpoint} sent to subscribe endpoint`);
    }
}
