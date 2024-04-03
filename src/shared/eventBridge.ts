import { EventBridgeClient, PutTargetsCommand, Target } from "@aws-sdk/client-eventbridge";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const eventBridgeClient = new EventBridgeClient({
    region: "eu-west-2",
    ...(process.env.IS_LOCAL === "true"
        ? {
              endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
          }
        : {}),
});

export const putEventBridgeTarget = async (rule: string, targets: Target[]) => {
    await eventBridgeClient.send(
        new PutTargetsCommand({
            Rule: rule,
            Targets: targets,
        }),
    );
};
