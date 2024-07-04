import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import Bree from "bree";
import Pino from "pino";

const { CLEARDOWN_FREQUENCY_IN_SECONDS: cleardownFrequency, PROCESSOR_FREQUENCY_IN_SECONDS: generatorFrequency } =
    process.env;

if (!cleardownFrequency || !generatorFrequency) {
    throw new Error("Missing env vars - CLEARDOWN_FREQUENCY_IN_SECONDS, PROCESSOR_FREQUENCY_IN_SECONDS must be set");
}

const logger = Pino();

const bree = new Bree({
    logger: Pino(),
    jobs: [
        {
            name: "avl-cleardown",
            interval: `${cleardownFrequency}s`,
            timeout: 0,
            closeWorkerAfterMs: 32000,
        },
        {
            name: "siri-vm-generator",
            interval: `${generatorFrequency}s`,
            timeout: 0,
            closeWorkerAfterMs: 30000,
        },
    ],
    errorHandler: async (error) => {
        logger.error(error);

        await putMetricData("custom/SiriVmGenerator", [
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
