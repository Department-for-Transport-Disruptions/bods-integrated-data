import { logger } from "@baselime/lambda-logger";

export const handler = () => {
    try {
        if (process.env.IS_LOCAL === "true") {
            logger.info(`Hello world!`);
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Lambda has failed", e);

            throw e;
        }

        throw e;
    }
};
