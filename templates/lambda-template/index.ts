import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { EXAMPLE_VAR: exampleVar } = process.env;

        if (!exampleVar) {
            throw new Error("Missing env vars - EXAMPLE_VAR must be set");
        }

        logger.info("Executed lambda-template", { exampleVar });
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the lambda-template function", e);
        }

        throw e;
    }
};
