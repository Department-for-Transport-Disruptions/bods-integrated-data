import { logger } from "@baselime/lambda-logger";
import { mockSiriVm } from "./mockSiriVm";

export const handler = async () => {
    try {
        const { STAGE: stage, DATA_ENDPOINT: dataEndpoint } = process.env;

        if (!dataEndpoint) {
            throw new Error("Missing env vars: DATA_ENDPOINT must be set");
        }

        const siriVm = mockSiriVm;

        //TODO DEANNA: how do we get real subscription ids?
        const url = stage === "local" ? `${dataEndpoint}?subscriptionId=test-subscription-id` : `${dataEndpoint}`;

        const res = await fetch(url, {
            method: "POST",
            body: siriVm,
        });

        if (!res.ok) {
            logger.error(`Unable to send AVL data to: ${url}`);
        }

        logger.info(`Successfully sent AVL data to: ${url}`);

        return;
    } catch (e) {
        if (e instanceof Error) {
            logger.error("Lambda has failed", e);

            throw e;
        }

        throw e;
    }
};
