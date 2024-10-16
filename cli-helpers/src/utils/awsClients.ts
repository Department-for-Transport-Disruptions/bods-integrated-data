import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = "eu-west-2";
const LOCALSTACK_HOSTNAME = "http://localhost:4566";

export const createDynamoDbDocClient = (stage: string) => {
    return DynamoDBDocumentClient.from(
        new DynamoDBClient({
            region: AWS_REGION,
            ...(stage === "local"
                ? {
                      endpoint: LOCALSTACK_HOSTNAME,
                      credentials: {
                          accessKeyId: "DUMMY",
                          secretAccessKey: "DUMMY",
                      },
                  }
                : {}),
        }),
    );
};

export const createLambdaClient = (stage: string) => {
    return new LambdaClient({
        region: AWS_REGION,
        ...(stage === "local"
            ? {
                  endpoint: LOCALSTACK_HOSTNAME,
                  credentials: {
                      accessKeyId: "DUMMY",
                      secretAccessKey: "DUMMY",
                  },
              }
            : {}),
    });
};

export const createS3Client = (stage: string) => {
    return new S3Client({
        region: AWS_REGION,
        ...(stage === "local"
            ? {
                  endpoint: LOCALSTACK_HOSTNAME,
                  credentials: {
                      accessKeyId: "DUMMY",
                      secretAccessKey: "DUMMY",
                  },
              }
            : {}),
    });
};

export const createSecretsManagerClient = (stage: string) => {
    return new SecretsManagerClient({
        region: AWS_REGION,
        ...(stage === "local"
            ? {
                  endpoint: LOCALSTACK_HOSTNAME,
                  credentials: {
                      accessKeyId: "DUMMY",
                      secretAccessKey: "DUMMY",
                  },
              }
            : {}),
    });
};
