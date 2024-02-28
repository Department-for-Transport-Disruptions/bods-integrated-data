import { putS3Object } from "@bods-integrated-data/shared";
import axios from "axios";
import * as logger from "lambda-log";
import { randomUUID } from "crypto";

export const handler = async () => {
    logger.options.dev = process.env.NODE_ENV !== "production";
    logger.options.debug = process.env.ENABLE_DEBUG_LOGS === "true" || process.env.NODE_ENV !== "production";

    logger.options.meta = {
        id: randomUUID(),
    };

    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        logger.info("Starting naptan retriever");

        const response = await axios.get("https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv", {
            responseType: "arraybuffer",
        });

        logger.info("Data retrieved");

        await putS3Object({
            Bucket: bucketName,
            Key: "Stops.csv",
            ContentType: "text/csv",
            Body: response.data as string,
        });

        logger.info("Naptan retriever successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the naptan retriever");
            logger.error(e);
        }

        throw e;
    }
};
