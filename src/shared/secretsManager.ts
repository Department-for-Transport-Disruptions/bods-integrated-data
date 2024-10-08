import {
    GetSecretValueCommand,
    GetSecretValueCommandInput,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isLocal = process.env.STAGE === "local";

const client = new SecretsManagerClient({
    endpoint: localStackHost ? `http://${localStackHost}:4566` : isLocal ? "http://localhost:4566" : undefined,
    region: "eu-west-2",
});

export const getSecret = async <T>(input: GetSecretValueCommandInput): Promise<T> => {
    const response = await client.send(new GetSecretValueCommand(input));
    const secret = response.SecretString;

    if (!secret) {
        throw new Error(`Secret could not be retrieved: ${input.SecretId}`);
    }

    return JSON.parse(secret) as T;
};
