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
        },
        {
            name: "avl-cleardown",
            interval: `${process.env.CLEARDOWN_FREQUENCY_IN_SECONDS}s`,
            timeout: 0,
        },
    ],
    errorHandler: (error) => {
        logger.error(error);
    },
});

void (async () => {
    await bree.start();
})();
