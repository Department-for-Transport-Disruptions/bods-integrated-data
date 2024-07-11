import { GetSecretValueCommand, ListSecretsCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

export const getSecretByKey = async <T extends string>(stage: string, key: string): Promise<T> => {
    const client = new SecretsManagerClient({
        endpoint: stage === "local" ? "http://localhost:4566" : undefined,
        region: "eu-west-2",
    });

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

    const secretId = secretsList[0].ARN;

    const getSecretCommand = new GetSecretValueCommand({
        SecretId: secretId,
    });

    const response = await client.send(getSecretCommand);
    const secret = response.SecretString;

    if (!secret) {
        throw new Error(`Secret could not be retrieved: ${secretId}`);
    }

    return JSON.parse(secret) as T;
};
