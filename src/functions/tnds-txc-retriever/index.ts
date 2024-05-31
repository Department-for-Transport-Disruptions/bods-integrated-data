import { Writable } from "stream";
import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import { Client } from "basic-ftp";

interface FtpCredentials {
    host: string;
    user: string;
    password: string;
}

const getZipFilesFromFTP = async (client: Client): Promise<Map<string, Uint8Array>> => {
    const downloadedFiles: Map<string, Uint8Array> = new Map();
    const allFiles = await client.list();
    const zipFiles = allFiles.filter((file) => file.name.includes(".zip"));

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
        const upload = startS3Upload(bucket, `${prefix}/${fileName}`, content, "application/zip");
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

export const handler = async () => {
    const { TXC_ZIPPED_BUCKET_NAME: txcZippedBucketName, TNDS_FTP_ARN: ftpArn } = process.env;

    if (!txcZippedBucketName) {
        throw new Error("Missing env vars - TXC_ZIPPED_BUCKET_NAME must be set");
    }

    if (!ftpArn) {
        throw new Error("Missing env var - TNDS_FTP_ARN must be set");
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
            logger.error("There was an error retrieving TNDS TXC data", e);
        }

        throw e;
    }
};
