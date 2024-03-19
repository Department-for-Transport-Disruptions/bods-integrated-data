import { logger } from "@baselime/lambda-logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import axios from "axios";
import { PassThrough, Stream } from "stream";

const getBodsDataAndUploadToS3 = async (txcZippedBucketName: string) => {
    logger.info("Starting retrieval of BODS data");

    const response = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/timetable/download/bulk_archive", {
        responseType: "stream",
    });

    const passThrough = new PassThrough();

    const upload = startS3Upload(txcZippedBucketName, "bods.zip", passThrough, "application/zip");

    response.data.pipe(passThrough);

    await upload.done();
};

export const handler = async () => {
    const { TXC_ZIPPED_BUCKET_NAME: txcZippedBucketName } = process.env;

    if (!txcZippedBucketName) {
        throw new Error("Missing env vars - TXC_ZIPPED_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of BODS TXC data");

        await getBodsDataAndUploadToS3(txcZippedBucketName);

        logger.info("BODS TXC retrieval complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving BODS TXC data", e);
        }

        throw e;
    }
};
