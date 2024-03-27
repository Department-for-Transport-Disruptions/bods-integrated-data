import {
    GetObjectCommand,
    GetObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PassThrough, Readable } from "stream";

const replaceSpecialCharacters = (input: string) => input.replace(/[^a-zA-Z0-9._\-!\*\'\(\)\/]/g, "_");
const localStackHost = process.env.LOCALSTACK_HOSTNAME;

const client = new S3Client({
    region: "eu-west-2",
    ...(process.env.IS_LOCAL === "true"
        ? {
              endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
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

export const getPresignedUrl = (input: GetObjectCommandInput, expiresIn: number) => {
    return getSignedUrl(
        client,
        new GetObjectCommand({
            ...input,
            Key: input.Key ? decodeURIComponent(input.Key) : undefined,
        }),
        { expiresIn },
    );
};

export const createLazyDownloadStreamFrom = (bucket: string, key: string): Readable => {
    let streamCreated = false;
    const stream = new PassThrough();

    stream.on("newListener", (event) => {
        if (!streamCreated && event == "data") {
            void (async () => {
                await initDownloadStream(bucket, key, stream);
                streamCreated = true;
            })();
        }
    });

    return stream;
};

export const initDownloadStream = async (bucket: string, key: string, stream: PassThrough) => {
    try {
        const { Body: body } = await getS3Object({ Bucket: bucket, Key: key });

        if (!body) {
            stream.emit("error", new Error(`Received undefined body from s3 when retrieving object ${bucket}/${key}`));
        } else if (!("on" in body)) {
            stream.emit(
                "error",
                new Error(
                    `Received a ReadableStream<any> or Blob from s3 when getting object ${bucket}/${key} instead of Readable`,
                ),
            );
        } else {
            body.on("error", (err) => stream.emit("error", err)).pipe(stream);
        }
    } catch (e) {
        stream.emit("error", e);
    }
};
