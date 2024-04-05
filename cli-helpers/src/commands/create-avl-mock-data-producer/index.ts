import { Command, Flags } from "@oclif/core";
import inquirer from "inquirer";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

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
            const responses = await inquirer.prompt([
                {
                    name: "name",
                    message: "Insert name of mock data producer",
                    type: "input",
                },
            ]);

            name = responses.name;
        }

        if (!stage) {
            const responses = await inquirer.prompt([
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

        const mockProducerSubscriptionInfo = {
            dataProducerEndpoint: `https://${name}.com`,
            description: `Mock data producer, name: ${name}`,
            shortDescription: "Mock data producer",
            username: "dummy-username",
            password: "dummy-password",
            requestorRef: "BODS_MOCK_PRODUCER",
        };


        const body = { body: JSON.stringify(mockProducerSubscriptionInfo) };
        const stringBody = JSON.stringify(body);

        const payload = Buffer.from(stringBody).toString("base64");

        const example = { body: `{\"dataProducerEndpoint\": \"http://www.${name}.com\",\"description\": \"Mock AVL producer - ${name}\",\"shortDescription\": \"shortDescription\",\"username\": \"test-username\",\"password\": \"test-password\",\"requestorRef\": \"BODS_MOCK_PRODUCER\"}` };

        await lambdaClient.send(new InvokeCommand({
            FunctionName: `avl-subscriber-${stage}`,
            InvocationType: "Event",
            Payload: JSON.stringify(example),
        }));

        console.log(`Mock AVL data producer created, name: ${name}`);
    }
}
