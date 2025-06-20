import { writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@bods-integrated-data/shared/logger";
import { getS3Object, listAllS3Objects, putS3Object } from "@bods-integrated-data/shared/s3";
import { notEmpty } from "@bods-integrated-data/shared/utils";
import AdmZip from "adm-zip";
import { Handler } from "aws-lambda";

const downloadAndZipFiles = async (sourceBucket: string, targetBucket: string, prefix: string) => {
    const zip = new AdmZip();

    const objects = await listAllS3Objects({
        Bucket: sourceBucket,
        Prefix: prefix,
    });

    const keys = objects.map((obj) => obj.Key).filter(notEmpty) ?? [];

    for (const key of keys) {
        const getResponse = await getS3Object({
            Bucket: sourceBucket,
            Key: key,
        });

        const body = await getResponse.Body?.transformToByteArray();

        if (!body) {
            continue;
        }

        const buffer = Buffer.from(body);

        const filename = path.basename(key);

        const tmpPath = path.join("/tmp", filename);
        await writeFile(tmpPath, buffer);

        zip.addLocalFile(tmpPath);
    }

    await putS3Object({
        Bucket: targetBucket,
        Key: `${prefix}.zip`,
        Body: zip.toBuffer(),
        ContentType: "application/zip",
        StorageClass: "INTELLIGENT_TIERING",
    });
};

export const handler: Handler = async (event) => {
    try {
        const { TFL_TXC_BUCKET_NAME: sourceBucket, ZIPPED_TFL_TXC_BUCKET_NAME: targetBucket } = process.env;

        if (!sourceBucket || !targetBucket) {
            throw new Error(
                "Missing environment variables: TFL_TXC_BUCKET_NAME and ZIPPED_TFL_TXC_BUCKET_NAME must be set.",
            );
        }

        if (!event.datePrefix) {
            throw new Error("Missing event property - datePrefix must be set");
        }

        await downloadAndZipFiles(sourceBucket, targetBucket, event.datePrefix);
    } catch (error) {
        logger.error(error, "Error zipping TfL TxC files");
        throw error;
    }
};
