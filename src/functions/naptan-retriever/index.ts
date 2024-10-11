import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { Handler } from "aws-lambda";
import axios from "axios";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

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
            logger.error(e, "There was a problem with the naptan retriever");
        }

        throw e;
    }
};
