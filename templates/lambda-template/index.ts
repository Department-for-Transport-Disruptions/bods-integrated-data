import { logger } from "@baselime/lambda-logger";

export const handler = async () => {
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
