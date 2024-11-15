import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const getClientDefaults = () => ({ region: "eu-west-2" });

export const createCloudWatchClient = () => {
    return new CloudWatchClient(getClientDefaults());
};

export const createDynamoDbDocClient = () => {
    return DynamoDBDocumentClient.from(new DynamoDBClient(getClientDefaults()));
};

export const createLambdaClient = () => {
    return new LambdaClient(getClientDefaults());
};

export const createSecretsManagerClient = () => {
    return new SecretsManagerClient(getClientDefaults());
};

export const createSchedulerClient = () => {
    return new SchedulerClient(getClientDefaults());
};

export const createSqsClient = () => {
    return new SQSClient(getClientDefaults());
};
