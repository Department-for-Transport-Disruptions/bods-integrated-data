import {
    CreateEventSourceMappingCommand,
    CreateEventSourceMappingCommandInput,
    LambdaClient,
} from "@aws-sdk/client-lambda";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isLocal = process.env.STAGE === "local";

const client = new LambdaClient({
    endpoint: localStackHost ? `http://${localStackHost}:4566` : isLocal ? "http://localhost:4566" : undefined,
    region: "eu-west-2",
});

export const createEventSourceMapping = (input: CreateEventSourceMappingCommandInput) => {
    return client.send(new CreateEventSourceMappingCommand(input));
};
