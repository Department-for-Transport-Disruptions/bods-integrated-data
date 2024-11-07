import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const getClientDefaults = (stage: string) => ({
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

export const createCloudWatchClient = (stage: string) => {
    return new CloudWatchClient(getClientDefaults(stage));
};

export const createDynamoDbDocClient = (stage: string) => {
    return DynamoDBDocumentClient.from(new DynamoDBClient(getClientDefaults(stage)));
};

export const createLambdaClient = (stage: string) => {
    return new LambdaClient(getClientDefaults(stage));
};

export const createS3Client = (stage: string) => {
    return new S3Client(getClientDefaults(stage));
};

export const createSecretsManagerClient = (stage: string) => {
    return new SecretsManagerClient(getClientDefaults(stage));
};

export const createSchedulerClient = (stage: string) => {
    return new SchedulerClient(getClientDefaults(stage));
};

export const createSqsClient = (stage: string) => {
    return new SQSClient(getClientDefaults(stage));
};
