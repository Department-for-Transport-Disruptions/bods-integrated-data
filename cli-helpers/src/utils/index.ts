import { InvokeCommand, InvokeCommandInputType, LambdaClient } from "@aws-sdk/client-lambda";
import { logger } from "@baselime/lambda-logger";
import { Option } from "@commander-js/extra-typings";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

export const STAGES = ["local", "dev"];

export const STAGE_OPTION = new Option("-s, --stage <stage>", "Stage to use").choices(STAGES);

export const STAGE_OPTION_WITH_DEFAULT = new Option("-s, --stage <stage>", "Stage to use")
    .choices(STAGES)
    .default("local");

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
