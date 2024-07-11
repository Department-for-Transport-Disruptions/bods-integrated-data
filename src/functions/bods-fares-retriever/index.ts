import { PassThrough, Stream } from "node:stream";
import { logger } from "@bods-integrated-data/shared/logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import axios from "axios";

const getFaresDataAndUploadToS3 = async (faresZippedBucketName: string) => {
    logger.info("Starting retrieval of fares data");

    const response = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/fares/download/bulk_archive", {
        responseType: "stream",
    });

    const passThrough = new PassThrough();

    const upload = startS3Upload(faresZippedBucketName, "fares.zip", passThrough, "application/zip");

    response.data.pipe(passThrough);

    await upload.done();
};

export const handler = async () => {
    const { FARES_ZIPPED_BUCKET_NAME: faresZippedBucketName } = process.env;

    if (!faresZippedBucketName) {
        throw new Error("Missing env vars - FARES_ZIPPED_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of fares data");

        await getFaresDataAndUploadToS3(faresZippedBucketName);

        logger.info("Fares retrieval complete");

        return {
            faresZippedBucketName,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving fares data", e);
        }

        throw e;
    }
};
