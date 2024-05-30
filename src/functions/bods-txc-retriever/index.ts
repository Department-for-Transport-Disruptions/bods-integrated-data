import { Stream } from "stream";
import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import axios from "axios";
import { Entry, Parse } from "unzipper";

const getBodsDataAndUploadToS3 = async (txcZippedBucketName: string, txcBucketName: string, prefix: string) => {
    logger.info("Starting retrieval of BODS data");

    const response = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/timetable/download/bulk_archive", {
        responseType: "stream",
    });

    const zip = response.data.pipe(
        Parse({
            forceStream: true,
        }),
    );

    const promises = [];

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        const type = entry.type;

        if (type === "File") {
            let upload;

            if (fileName.endsWith(".zip")) {
                upload = startS3Upload(txcZippedBucketName, `${prefix}/${fileName}`, entry, "application/zip");
                promises.push(upload.done());
            } else if (fileName.endsWith(".xml")) {
                upload = startS3Upload(txcBucketName, `${prefix}/${fileName}`, entry, "application/xml");
                promises.push(upload.done());
            }
        }

        entry.autodrain();
    }

    await Promise.all(promises);
};

export const handler = async () => {
    const { TXC_ZIPPED_BUCKET_NAME: txcZippedBucketName, TXC_BUCKET_NAME: txcBucketName } = process.env;

    if (!txcZippedBucketName || !txcBucketName) {
        throw new Error("Missing env vars - TXC_ZIPPED_BUCKET_NAME and TXC_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of BODS TXC data");

        const prefix = getDate().format("YYYYMMDD");
        await getBodsDataAndUploadToS3(txcZippedBucketName, txcBucketName, prefix);

        logger.info("BODS TXC retrieval complete");

        return {
            bodsTxcZippedBucketName: txcZippedBucketName,
            bodsTxcBucketName: txcBucketName,
            prefix,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving BODS TXC data", e);
        }

        throw e;
    }
};
