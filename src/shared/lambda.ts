import {
    CreateEventSourceMappingCommand,
    CreateEventSourceMappingCommandInput,
    DeleteEventSourceMappingCommand,
    DeleteEventSourceMappingCommandInput,
    LambdaClient,
} from "@aws-sdk/client-lambda";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isLocal = process.env.STAGE === "local";

const client = new LambdaClient({
    endpoint: localStackHost ? `http://${localStackHost}:4566` : isLocal ? "http://localhost:4566" : undefined,
    region: "eu-west-2",
});

export const createEventSourceMapping = async (input: CreateEventSourceMappingCommandInput) => {
    const response = await client.send(new CreateEventSourceMappingCommand(input));

    if (!response.UUID) {
        throw new Error(`Error creating event source mapping: ${input.EventSourceArn}`);
    }

    return response.UUID;
};

export const deleteEventSourceMapping = (input: DeleteEventSourceMappingCommandInput) => {
    return client.send(new DeleteEventSourceMappingCommand(input));
};
