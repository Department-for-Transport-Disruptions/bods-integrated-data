import { Writable } from "node:stream";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import { Handler } from "aws-lambda";
import { Client } from "basic-ftp";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

interface FtpCredentials {
    host: string;
    user: string;
    password: string;
}

const getZipFilesFromFTP = async (client: Client): Promise<Map<string, Uint8Array>> => {
    const downloadedFiles: Map<string, Uint8Array> = new Map();
    const allFiles = await client.list();
    for (const file of allFiles) {
        logger.info(`File found: ${file.name}`);
    }
    const zipFiles = allFiles.filter(
        /**
         * The NCSD.zip file, which represents coach data, is excluded because coach data is now retrieved from BODS.
         * CSV files containing useful meta information have been temporarily included because we want to analyse them during the coach data integration work.
         */
        (file) => (file.name.includes(".zip") && file.name !== "NCSD.zip") || file.name.includes(".csv"),
    );

    for (const file of zipFiles) {
        const chunks: Buffer[] = [];
        const writableStream = new Writable({
            write(chunk: Buffer, _encoding, callback) {
                chunks.push(chunk);
                callback();
            },
        });
        await client.downloadTo(writableStream, file.name);
        const buffer = Buffer.concat(chunks);
        downloadedFiles.set(file.name, new Uint8Array(buffer));
    }

    return downloadedFiles;
};

const uploadZipFilesToS3 = async (files: Map<string, Uint8Array>, bucket: string, prefix: string) => {
    for (const [fileName, content] of files.entries()) {
        const contentType = fileName.endsWith(".zip")
            ? "application/zip"
            : fileName.endsWith(".zip")
              ? "text/csv"
              : "text/plain";

        const upload = startS3Upload(bucket, `${prefix}/${fileName}`, content, contentType);
        await upload.done();
    }
};

const getTndsDataAndUploadToS3 = async (
    txcZippedBucketName: string,
    ftpCredentials: FtpCredentials,
    prefix: string,
) => {
    const { host, user, password } = ftpCredentials;
    const timeoutMs = 600000;
    const client = new Client(timeoutMs);
    try {
        await client.access({
            host,
            user,
            password,
        });

        const zipFiles = await getZipFilesFromFTP(client);

        logger.info("Zip files recieved, uploading to S3");

        await uploadZipFilesToS3(zipFiles, txcZippedBucketName, prefix);
    } finally {
        client.close();
    }
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TXC_ZIPPED_BUCKET_NAME: txcZippedBucketName, TNDS_FTP_ARN: ftpArn } = process.env;

    if (!txcZippedBucketName || !ftpArn) {
        throw new Error("Missing env vars - TXC_ZIPPED_BUCKET_NAME and TNDS_FTP_ARN must be set");
    }

    try {
        const credentials = await getSecret<FtpCredentials>({ SecretId: ftpArn });

        logger.info("Starting retrieval of TNDS TXC data");

        const prefix = getDate().format("YYYYMMDD");
        await getTndsDataAndUploadToS3(txcZippedBucketName, credentials, prefix);

        logger.info("TNDS TXC retrieval complete");

        return {
            tndsTxcZippedBucketName: txcZippedBucketName,
            prefix,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error retrieving TNDS TXC data");
        }

        throw e;
    }
};
