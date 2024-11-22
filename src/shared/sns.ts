import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({ region: "eu-west-2" });

export const publishToSnsTopic = async (topicArn: string, message: string, groupId?: string) => {
    await snsClient.send(
        new PublishCommand({
            TopicArn: topicArn,
            Message: message,
            MessageGroupId: groupId,
        }),
    );
};
