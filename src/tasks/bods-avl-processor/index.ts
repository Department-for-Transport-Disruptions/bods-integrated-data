import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import Bree from "bree";
import Pino from "pino";

const logger = Pino();

const bree = new Bree({
    logger: Pino(),
    jobs: [
        {
            name: "avl-processor",
            interval: `${process.env.PROCESSOR_FREQUENCY_IN_SECONDS}s`,
            timeout: 0,
            closeWorkerAfterMs: 32000,
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

        await putMetricData("custom/BODSAVLProcessor", [
            {
                MetricName: "Errors",
                Value: 1,
            },
        ]);
    },
});

void (async () => {
    await bree.start();
})();
