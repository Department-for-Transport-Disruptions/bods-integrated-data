import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { logger } from "@baselime/lambda-logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import { Client } from "basic-ftp";
import { Writable } from "stream";

interface FtpCredentials {
    host: string;
    user: string;
    password: string;
}

const secretsClient = new SecretsManagerClient({ region: "eu-west-2" });

const getZipFilesFromFTP = async (client: Client): Promise<Map<string, Uint8Array>> => {
    const downloadedFiles: Map<string, Uint8Array> = new Map();
    const allFiles = await client.list();
    const zipFiles = allFiles.filter((file) => file.name.includes(".zip"));

    for (const file of zipFiles) {
        const chunks: Buffer[] = [];
        const writableStream = new Writable({
            write(chunk: Buffer, encoding, callback) {
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

const uploadZipFilesToS3 = async (files: Map<string, Uint8Array>, bucket: string) => {
    for (const [fileName, content] of files.entries()) {
        const upload = startS3Upload(bucket, fileName, content, "application/zip");
        await upload.done();
    }
};

const getFtpCredentials = async (ftpCredentialsArn: string): Promise<FtpCredentials> => {
    const ftpCredentialsSecret = await secretsClient.send(
        new GetSecretValueCommand({
            SecretId: ftpCredentialsArn,
        }),
    );

    if (!ftpCredentialsSecret.SecretString) {
        throw new Error("FTP credentials secret could not be retrieved");
    }

    return JSON.parse(ftpCredentialsSecret.SecretString) as FtpCredentials;
};

const getTndsDataAndUploadToS3 = async (txcZippedBucketName: string, ftpCredentials: FtpCredentials) => {
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

        await uploadZipFilesToS3(zipFiles, txcZippedBucketName);
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
        const credentials = await getFtpCredentials(ftpArn);

        logger.info("Starting retrieval of TNDS TXC data");

        await getTndsDataAndUploadToS3(txcZippedBucketName, credentials);

        logger.info("TNDS TXC retrieval complete");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error retrieving TNDS TXC data", e);
        }

        throw e;
    }
};
