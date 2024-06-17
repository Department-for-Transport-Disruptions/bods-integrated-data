import { PassThrough, Stream } from "node:stream";
import { logger } from "@baselime/lambda-logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import axios from "axios";

const getDisruptionsDataAndUploadToS3 = async (disruptionsZippedBucketName: string) => {
    logger.info("Starting retrieval of disruptions data");

    const response = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/disruptions/download/bulk_archive", {
        responseType: "stream",
    });

    const passThrough = new PassThrough();

    const upload = startS3Upload(disruptionsZippedBucketName, "disruptions.zip", passThrough, "application/zip");

    response.data.pipe(passThrough);

    await upload.done();
};

export const handler = async () => {
    const { DISRUPTIONS_ZIPPED_BUCKET_NAME: disruptionsZippedBucketName } = process.env;

    if (!disruptionsZippedBucketName) {
        throw new Error("Missing env vars - DISRUPTIONS_ZIPPED_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of disruptions data");

        await getDisruptionsDataAndUploadToS3(disruptionsZippedBucketName);

        logger.info("Disruptions retrieval complete");

        return {
            disruptionsZippedBucketName,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving disruptions data", e);
        }

        throw e;
    }
};
