import {
    CreateQueueCommand,
    CreateQueueCommandInput,
    DeleteQueueCommand,
    DeleteQueueCommandInput,
    SQSClient,
} from "@aws-sdk/client-sqs";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isLocal = process.env.STAGE === "local";

const client = new SQSClient({
    endpoint: localStackHost ? `http://${localStackHost}:4566` : isLocal ? "http://localhost:4566" : undefined,
    region: "eu-west-2",
});

export const createQueue = async (input: CreateQueueCommandInput) => {
    const response = await client.send(new CreateQueueCommand(input));

    if (!response.QueueUrl) {
        throw new Error(`Error creating queue: ${input.QueueName}`);
    }

    return response.QueueUrl;
};

export const deleteQueue = (input: DeleteQueueCommandInput) => {
    return client.send(new DeleteQueueCommand(input));
};
