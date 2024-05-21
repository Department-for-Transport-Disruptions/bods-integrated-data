import Bree from "bree";

const bree = new Bree({
    jobs: [
        {
            name: "avl-processor",
            interval: `${process.env.PROCESSOR_FREQUENCY_IN_SECONDS}s`,
            timeout: 0,
            closeWorkerAfterMs: 30000,
        },
        {
            name: "generate-gtfs",
            interval: `${process.env.PROCESSOR_FREQUENCY_IN_SECONDS}s`,
            timeout: 10000,
            closeWorkerAfterMs: 30000,
        },
        {
            name: "avl-cleardown",
            interval: `${process.env.CLEARDOWN_FREQUENCY_IN_SECONDS}s`,
            timeout: 0,
        },
    ],
});

void (async () => {
    await bree.start();
})();
