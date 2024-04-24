import { logger } from "@baselime/lambda-logger";
import { getS3Object, startS3Upload } from "@bods-integrated-data/shared/s3";
import { S3Event } from "aws-lambda";
import { Entry, Parse } from "unzipper";
import { Readable, Stream } from "stream";

export const getFilePath = (filePathWithFile: string) => {
    const path = filePathWithFile.substring(0, filePathWithFile.lastIndexOf("."));

    if (!path) {
        return "";
    }

    return `${path}/`;
};

export const unzip = async (object: Stream, unzippedBucketName: string, key: string) => {
    const zip = object.pipe(
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
                await unzip(entry, unzippedBucketName, `${getFilePath(key)}${fileName}`);
            } else if (fileName.endsWith(".xml")) {
                upload = startS3Upload(unzippedBucketName, `${getFilePath(key)}${fileName}`, entry, "application/xml");
                promises.push(upload.done());
            }

            entry.autodrain();
        } else {
            entry.autodrain();
        }
    }

    await Promise.all(promises);
};

export const handler = async (event: S3Event) => {
    const {
        bucket: { name: bucketName },
        object: { key },
    } = event.Records[0].s3;

    try {
        const { UNZIPPED_BUCKET_NAME: unzippedBucketName } = process.env;

        if (!unzippedBucketName) {
            throw new Error("Missing env vars - UNZIPPED_BUCKET_NAME must be set");
        }

        if (!bucketName || !key) {
            throw new Error("Bucket name or object key not in event");
        }

        const object = await getS3Object({
            Bucket: bucketName,
            Key: key,
        });

        if (!object.Body || !(object.Body instanceof Readable)) {
            throw new Error("No data in file");
        }

        await unzip(object.Body, unzippedBucketName, key);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(`Error unzipping file at s3://${bucketName}/${key}`, e);
        }

        throw e;
    }
};
