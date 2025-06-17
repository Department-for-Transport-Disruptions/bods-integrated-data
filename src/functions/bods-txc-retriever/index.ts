import { Stream } from "node:stream";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import { Handler } from "aws-lambda";
import axios from "axios";
import { Entry, Parse } from "unzipper";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const getBodsDataAndUploadToS3 = async (
    downloadUrl: string,
    txcZippedBucketName: string,
    txcBucketName: string,
    prefix: string,
) => {
    const response = await axios.get<Stream>(downloadUrl, {
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
            let upload: ReturnType<typeof startS3Upload>;

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

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    const { TXC_ZIPPED_BUCKET_NAME: txcZippedBucketName, TXC_BUCKET_NAME: txcBucketName } = process.env;

    if (!txcZippedBucketName || !txcBucketName) {
        throw new Error("Missing env vars - TXC_ZIPPED_BUCKET_NAME and TXC_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of BODS TXC data");

        const prefix = getDate().format("YYYYMMDD");

        logger.info("Starting retrieval of BODS bus data");
        await getBodsDataAndUploadToS3(
            "https://data.bus-data.dft.gov.uk/timetable/download/bulk_archive",
            txcZippedBucketName,
            txcBucketName,
            prefix,
        );

        logger.info("Starting retrieval of BODS coach data");
        await getBodsDataAndUploadToS3(
            "https://coach.bus-data.dft.gov.uk/TxC-2.4.zip",
            txcZippedBucketName,
            txcBucketName,
            prefix,
        );

        logger.info("BODS TXC retrieval complete");

        return {
            bodsTxcZippedBucketName: txcZippedBucketName,
            bodsTxcBucketName: txcBucketName,
            prefix,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error retrieving BODS TXC data");
        }

        throw e;
    }
};
