import { Stream } from "node:stream";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { unzip } from "@bods-integrated-data/shared/unzip";
import { Handler } from "aws-lambda";
import axios from "axios";

const getDisruptionsDataAndUploadToS3 = async (disruptionsUnzippedBucketName: string) => {
    logger.info("Starting retrieval of disruptions data");

    const response = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/disruptions/download/bulk_archive", {
        responseType: "stream",
    });

    await unzip(response.data, "disruptions.zip", disruptionsUnzippedBucketName);
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { DISRUPTIONS_UNZIPPED_BUCKET_NAME: disruptionsUnzippedBucketName } = process.env;

    if (!disruptionsUnzippedBucketName) {
        throw new Error("Missing env vars - DISRUPTIONS_UNZIPPED_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of disruptions data");

        await getDisruptionsDataAndUploadToS3(disruptionsUnzippedBucketName);

        logger.info("Disruptions retrieval complete");

        return {
            disruptionsUnzippedBucketName,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving disruptions data", e);
        }

        throw e;
    }
};
