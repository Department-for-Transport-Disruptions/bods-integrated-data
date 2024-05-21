import {
    GetSecretValueCommand,
    GetSecretValueCommandInput,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const client = new SecretsManagerClient({
    endpoint: localStackHost ? `http://${localStackHost}:4566` : undefined,
    region: "eu-west-2",
});

export const getSecret = async <T>(input: GetSecretValueCommandInput): Promise<T> => {
    const secret = await client.send(new GetSecretValueCommand(input));

    if (!secret.SecretString) {
        throw new Error(`Secret could not be retrieved: ${input.SecretId}`);
    }

    return JSON.parse(secret.SecretString) as T;
};
