import {
    GetSecretValueCommand,
    GetSecretValueCommandInput,
    ListSecretsCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const client = new SecretsManagerClient({
    endpoint: localStackHost ? `http://${localStackHost}:4566` : undefined,
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

export const getSecretByKey = async <T extends string>(key: string): Promise<T> => {
    const listSecretsCommand = new ListSecretsCommand({
        Filters: [
            {
                Key: "name",
                Values: [key],
            },
        ],
    });

    const listSecretsResponse = await client.send(listSecretsCommand);
    const secretsList = listSecretsResponse.SecretList;

    if (!secretsList) {
        throw new Error("Secrets list could not be retrieved");
    }

    if (secretsList.length === 0 || !secretsList[0].ARN) {
        throw new Error(`Secret with key does not exist: ${key}`);
    }

    return getSecret({ SecretId: secretsList[0].ARN });
};
