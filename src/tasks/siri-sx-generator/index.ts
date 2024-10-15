import { logger } from "@bods-integrated-data/shared/logger";
import Bree from "bree";

const { CLEARDOWN_FREQUENCY_IN_SECONDS: cleardownFrequency, GENERATOR_FREQUENCY_IN_SECONDS: generatorFrequency } =
    process.env;

if (!cleardownFrequency || !generatorFrequency) {
    throw new Error("Missing env vars - CLEARDOWN_FREQUENCY_IN_SECONDS, PROCESSOR_FREQUENCY_IN_SECONDS must be set");
}

const bree = new Bree({
    logger,
    jobs: [
        {
            name: "siri-sx-generator",
            interval: `${generatorFrequency}s`,
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
