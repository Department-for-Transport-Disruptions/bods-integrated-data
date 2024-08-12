import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { Handler } from "aws-lambda";
import axios from "axios";

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        logger.info("Starting NPTG retriever");

        const response = await axios.get("https://naptan.api.dft.gov.uk/v1/nptg", {
            responseType: "arraybuffer",
        });

        logger.info("Data retrieved");

        await putS3Object({
            Bucket: bucketName,
            Key: "NPTG.xml",
            ContentType: "application/xml",
            Body: response.data as string,
        });

        logger.info("NPTG retriever successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the NPTG retriever", e);
        }

        throw e;
    }
};
