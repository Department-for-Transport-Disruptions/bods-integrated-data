import { PassThrough, Stream } from "node:stream";
import { logger } from "@bods-integrated-data/shared/logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import axios from "axios";

const getNocDataAndUploadToS3 = async (nocBucketName: string) => {
    const response = await axios.get<Stream>("https://www.travelinedata.org.uk/noc/api/1.0/nocrecords.xml", {
        responseType: "stream",
    });

    const passThrough = new PassThrough();

    const upload = startS3Upload(nocBucketName, "noc.xml", passThrough, "application/xml");

    response.data.pipe(passThrough);

    await upload.done();
};

export const handler = async () => {
    const { NOC_BUCKET_NAME: nocBucketName } = process.env;

    if (!nocBucketName) {
        throw new Error("Missing env vars - NOC_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of NOC data");

        await getNocDataAndUploadToS3(nocBucketName);

        logger.info("NOC retrieval complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving NOC data", e);
        }

        throw e;
    }
};
