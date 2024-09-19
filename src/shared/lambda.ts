import {
    CreateEventSourceMappingCommand,
    CreateEventSourceMappingCommandInput,
    LambdaClient,
} from "@aws-sdk/client-lambda";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const client = new LambdaClient({
    region: "eu-west-2",
    ...(process.env.STAGE === "local"
        ? {
              endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
          }
        : {}),
});

export const createEventSourceMapping = async (input: CreateEventSourceMappingCommandInput) => {
    const response = await client.send(new CreateEventSourceMappingCommand(input));

    if (!response.UUID) {
        throw new Error(`Error creating event source mapping: ${input.EventSourceArn}`);
    }

    return response.UUID;
};
