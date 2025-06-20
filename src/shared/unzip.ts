import { Stream } from "node:stream";
import { S3ServiceException } from "@aws-sdk/client-s3";
import plimit from "p-limit";
import { Entry, Parse } from "unzipper";
import { logger } from "./logger";
import { startS3Upload } from "./s3";

export const getFilePath = (filePathWithFile: string) => {
    const path = filePathWithFile.substring(0, filePathWithFile.lastIndexOf("."));

    if (!path) {
        return "";
    }

    return `${path}/`;
};

// Retry upload with exponential backoff for rate limiting errors to account for zips with many files
const uploadWithRetry = async (entry: Entry, bucketName: string, key: string, maxRetries = 3): Promise<void> => {
    const buffer = await entry.buffer();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const upload = startS3Upload(bucketName, key, buffer, "application/xml");
            await upload.done();
            return;
        } catch (error) {
            if (!(error instanceof S3ServiceException)) {
                throw error;
            }

            const isRateLimitError = error.name === "SlowDown" || error.$metadata.httpStatusCode === 503;

            if (isRateLimitError && attempt < maxRetries) {
                const delay = Math.min(1000 * 2 ** (attempt - 1), 10000); // exponential backoff with a max delay of 10 seconds
                logger.info(`Rate limited uploading ${key}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
};

export const unzip = async (object: Stream, unzippedBucketName: string, key: string) => {
    const zip = object.pipe(
        Parse({
            forceStream: true,
        }),
    );

    const promises = [];

    const limit = plimit(10);

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        const type = entry.type;

        if (type === "File") {
            if (fileName.endsWith(".zip")) {
                await unzip(entry, unzippedBucketName, `${getFilePath(key)}${fileName}`);
            } else if (fileName.endsWith(".xml")) {
                const uploadTask = limit(() =>
                    uploadWithRetry(entry, unzippedBucketName, `${getFilePath(key)}${fileName}`, 10),
                );

                promises.push(uploadTask);
            }

            if (!fileName.endsWith(".zip") && !fileName.endsWith(".xml")) {
                entry.autodrain();
            }
        } else {
            entry.autodrain();
        }
    }

    await Promise.all(promises);
};
