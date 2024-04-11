import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Command, Flags } from "@oclif/core";
import inquirer from "inquirer";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

export default class CreateAvlMockDataProducer extends Command {
    static description = "Create AVL mock data producer";

    static flags = {
        name: Flags.string({ description: "Name of mock data producer" }),
        stage: Flags.string({ description: "Stage to use" }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(CreateAvlMockDataProducer);

        let { name, stage } = flags;

        if (!name) {
            const responses = await inquirer.prompt<{ name: string }>([
                {
                    name: "name",
                    message: "Insert name of mock data producer",
                    type: "input",
                },
            ]);

            name = responses.name;
        }

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

        const cleanName = name.replace(/\s+/g, "-");

        const invokePayload = {
            body: `{\"dataProducerEndpoint\": \"http://www.${cleanName}.com\",\"description\": \"Mock AVL producer - ${name}\",\"shortDescription\": \"shortDescription\",\"username\": \"test-username\",\"password\": \"test-password\",\"requestorRef\": \"BODS_MOCK_PRODUCER\"}`,
        };

        await lambdaClient.send(
            new InvokeCommand({
                FunctionName: `avl-subscriber-${stage}`,
                InvocationType: "Event",
                Payload: JSON.stringify(invokePayload),
            }),
        );

        // eslint-disable-next-line no-console
        console.log(`Mock AVL data producer created, name: ${cleanName}`);
    }
}
