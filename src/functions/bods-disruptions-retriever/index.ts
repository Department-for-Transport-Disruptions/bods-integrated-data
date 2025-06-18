import { Stream } from "node:stream";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { unzip } from "@bods-integrated-data/shared/unzip";
import { Handler } from "aws-lambda";
import axios from "axios";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const getDisruptionsDataAndUploadToS3 = async (disruptionsUnzippedBucketName: string) => {
    logger.info("Starting retrieval of disruptions data");

    const response = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/disruptions/download/bulk_archive", {
        responseType: "stream",
    });

    await unzip(response.data, disruptionsUnzippedBucketName, "disruptions.zip");
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const { DISRUPTIONS_UNZIPPED_BUCKET_NAME: disruptionsUnzippedBucketName } = process.env;

    if (!disruptionsUnzippedBucketName) {
        throw new Error("Missing env vars - DISRUPTIONS_UNZIPPED_BUCKET_NAME must be set");
    }

    try {
        await getDisruptionsDataAndUploadToS3(disruptionsUnzippedBucketName);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error retrieving disruptions data");
        }

        throw e;
    }
};
