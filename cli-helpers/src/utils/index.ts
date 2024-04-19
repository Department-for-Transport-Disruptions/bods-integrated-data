import { InvokeCommand, InvokeCommandInputType, LambdaClient } from "@aws-sdk/client-lambda";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

export const STAGES = ["local", "dev"];
export const DEFAULT_STAGE = "local";

export const invokeLambda = async (stage: string, invokeCommand: InvokeCommandInputType) => {
    const lambdaClient = new LambdaClient({
        region: "eu-west-2",
        ...(stage === "local"
            ? {
                  endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
                  credentials: {
                      accessKeyId: "DUMMY",
                      secretAccessKey: "DUMMY",
                  },
              }
            : {}),
    });

    try {
        console.log("Invoking lambda:", invokeCommand.FunctionName);
        await lambdaClient.send(new InvokeCommand(invokeCommand));
    } catch (error) {
        console.log("Failed to execute lambda:", error);
    } finally {
        lambdaClient.destroy();
    }
};
