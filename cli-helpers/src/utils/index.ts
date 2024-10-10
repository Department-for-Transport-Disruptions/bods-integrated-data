import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, InvokeCommandInputType, LambdaClient } from "@aws-sdk/client-lambda";
import { ListObjectsV2Command, S3Client, _Object } from "@aws-sdk/client-s3";
import { GetSecretValueCommand, ListSecretsCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, GetCommand, NativeAttributeValue } from "@aws-sdk/lib-dynamodb";
import { logger } from "@bods-integrated-data/shared/logger";
import { Option } from "@commander-js/extra-typings";
import inquirer, { QuestionMap } from "inquirer";

export const STAGES = ["local", "dev", "test", "prod"];

export const STAGE_OPTION = new Option("-s, --stage <stage>", "Stage to use").choices(STAGES);

type Prompt = {
    type: keyof QuestionMap;
    choices?: string[];
    default?: string;
};

export const withUserPrompt = async (name: string, prompt: Prompt) => {
    const response = await inquirer.prompt<{ [name: string]: string }>([
        {
            name,
            type: prompt.type,
            choices: prompt.choices,
            default: prompt.default,
        },
    ]);

    return response[name];
};

export const withUserPrompts = async <T extends { [key: string]: string }>(
    options: T,
    prompts: Record<keyof T, Prompt>,
) => {
    const answers: Record<keyof T, string> = { ...options };

    for await (const [option, prompt] of Object.entries(prompts) as Array<[key: keyof T, prompt: Prompt]>) {
        if (!answers[option]) {
            answers[option] = await withUserPrompt(option as string, prompt);
        }
    }

    return answers;
};

export const invokeLambda = async (stage: string, invokeCommand: InvokeCommandInputType) => {
    const lambdaClient = new LambdaClient({
        region: "eu-west-2",
        ...(stage === "local"
            ? {
                  endpoint: "http://localhost:4566",
                  credentials: {
                      accessKeyId: "DUMMY",
                      secretAccessKey: "DUMMY",
                  },
              }
            : {}),
    });

    try {
        logger.info(`Invoking lambda: ${invokeCommand.FunctionName}`);

        const response = await lambdaClient.send(new InvokeCommand(invokeCommand));

        logger.info("Invoke complete");

        if (invokeCommand.InvocationType === "RequestResponse") {
            const payload = response?.Payload?.transformToString();

            // Lambdas without a return statement will return a "null" payload
            if (payload && payload !== "null") {
                logger.info(`Response", ${JSON.stringify(JSON.parse(payload), null, 2)}`);
            }
        }

        return response;
    } catch (error) {
        logger.info(`Failed to execute lambda:", ${JSON.stringify(error)}`);
    } finally {
        lambdaClient.destroy();
    }
};

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

export const getDynamoDbItem = async <T extends Record<string, unknown>>(
    stage: string,
    tableName: string,
    key: Record<string, NativeAttributeValue>,
) => {
    const dynamoDbDocClient = DynamoDBDocumentClient.from(
        new DynamoDBClient({
            endpoint: stage === "local" ? "http://localhost:4566" : undefined,
            region: "eu-west-2",
        }),
    );

    const data = await dynamoDbDocClient.send(
        new GetCommand({
            TableName: tableName,
            Key: key,
        }),
    );

    return data.Item ? (data.Item as T) : null;
};

export const listS3ObjectsByCommonPrefix = async (client: S3Client, bucketName: string, delimiter: string) => {
    const response = await client.send(
        new ListObjectsV2Command({
            Bucket: bucketName,
            Delimiter: delimiter,
        }),
    );

    return response.CommonPrefixes || [];
};

export const listS3Objects = async (client: S3Client, bucketName: string, keyPrefix: string) => {
    const objects: _Object[] = [];
    let isTruncated = undefined;
    let startAfterKey = undefined;

    do {
        const response = await client.send(
            new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: keyPrefix,
                StartAfter: startAfterKey,
            }),
        );

        if (response.Contents) {
            objects.push(...response.Contents);
            startAfterKey = objects[objects.length - 1].Key;
        }

        isTruncated = response.IsTruncated;
    } while (isTruncated);

    return objects;
};
