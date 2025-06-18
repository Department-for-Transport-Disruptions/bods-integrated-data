import { Stream } from "node:stream";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import { Handler } from "aws-lambda";
import axios from "axios";
import { Entry, Parse } from "unzipper";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const getDataAndUploadToS3 = async (
    downloadUrl: string,
    zippedBucketName: string,
    bucketName: string,
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
                upload = startS3Upload(zippedBucketName, `${prefix}/${fileName}`, entry, "application/zip");
                promises.push(upload.done());
            } else if (fileName.endsWith(".xml")) {
                upload = startS3Upload(bucketName, `${prefix}/${fileName}`, entry, "application/xml");
                promises.push(upload.done());
            }
        }

        entry.autodrain();
    }

    await Promise.all(promises);
};

type BodsNetexRetrieverOutput = {
    netexZippedBucketName: string;
    prefix: string;
};

export const handler: Handler = async (event, context): Promise<BodsNetexRetrieverOutput> => {
    withLambdaRequestTracker(event, context);

    const { BUCKET_NAME, ZIPPED_BUCKET_NAME } = process.env;

    if (!BUCKET_NAME || !ZIPPED_BUCKET_NAME) {
        throw new Error("Missing env vars - BUCKET_NAME and ZIPPED_BUCKET_NAME must be set");
    }

    try {
        logger.info("Starting retrieval of BODS NeTEx data");
        const prefix = getDate().format("YYYYMMDD");

        await getDataAndUploadToS3(
            "https://data.bus-data.dft.gov.uk/fares/download/bulk_archive",
            ZIPPED_BUCKET_NAME,
            BUCKET_NAME,
            prefix,
        );

        logger.info("BODS NeTEx retrieval complete");

        return {
            netexZippedBucketName: ZIPPED_BUCKET_NAME,
            prefix,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error retrieving the NeTEx data");
        }

        throw e;
    }
};
