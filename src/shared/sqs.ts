import { SQSClient, SendMessageBatchCommand, SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;
const isDocker = process.env.IS_DOCKER;

const client = new SQSClient({
    region: "eu-west-2",
    ...(process.env.STAGE === "local"
        ? {
              endpoint:
                  localStackHost || isDocker ? "http://bods_integrated_data_localstack:4566" : "http://localhost:4566",
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
          }
        : {}),
});

export const sendBatchMessage = async (queueUrl: string, entries: SendMessageBatchRequestEntry[]) => {
    await client.send(
        new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: entries,
        }),
    );
};
