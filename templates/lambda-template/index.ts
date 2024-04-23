import { logger } from "@baselime/lambda-logger";

export const handler = async () => {
    try {
        if (process.env.STAGE === "local") {
            const message: string = await new Promise((resolve) => {
                setTimeout(() => {
                    resolve("Hello world");
                }, 100);
            });

            logger.info(message);
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Lambda has failed", e);

            throw e;
        }

        throw e;
    }
};
