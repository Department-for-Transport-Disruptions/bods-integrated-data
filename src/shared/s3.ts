import {
    GetObjectCommand,
    GetObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "stream";

const replaceSpecialCharacters = (input: string) => input.replace(/[^a-zA-Z0-9._\-!\*\'\(\)\/]/g, "_");

const client = new S3Client({
    region: "eu-west-2",
    ...(process.env.IS_LOCAL === "true"
        ? {
              endpoint: "http://localhost:4566",
              forcePathStyle: true,
              credentials: {
                  accessKeyId: "DUMMY",
                  secretAccessKey: "DUMMY",
              },
          }
        : {}),
});

export const getS3Object = async (input: GetObjectCommandInput) =>
    client.send(
        new GetObjectCommand({
            ...input,
            Key: input.Key ? decodeURIComponent(input.Key) : undefined,
        }),
    );
export const putS3Object = (input: PutObjectCommandInput) =>
    client.send(
        new PutObjectCommand({
            ...input,
            Key: input.Key ? replaceSpecialCharacters(input.Key) : undefined,
        }),
    );
export const startS3Upload = (
    bucket: string,
    key: string,
    body: PassThrough | Uint8Array,
    contentType: string,
    queueSize = 4,
    partSize = 1024 * 1024 * 5,
    leavePartsOnError = false,
) =>
    new Upload({
        client,
        params: {
            Bucket: bucket,
            Key: replaceSpecialCharacters(key),
            Body: body,
            ContentType: contentType,
        },
        queueSize,
        partSize,
        leavePartsOnError,
    });
