import { logger } from "@bods-integrated-data/shared/logger";
import Bree from "bree";

const bree = new Bree({
    logger,
    jobs: [
        {
            name: "avl-processor",
            interval: `${process.env.PROCESSOR_FREQUENCY_IN_SECONDS}s`,
            timeout: 0,
            closeWorkerAfterMs: 30000,
        },
        {
            name: "avl-cleardown",
            interval: `${process.env.CLEARDOWN_FREQUENCY_IN_SECONDS}s`,
            timeout: 0,
            closeWorkerAfterMs: 30000,
        },
    ],
    errorHandler: async (error) => {
        logger.error(error);
    },
});

void (async () => {
    await bree.start();
})();
