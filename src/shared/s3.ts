import {
    GetObjectCommand,
    GetObjectCommandInput,
    PutObjectCommand,
    PutObjectCommandInput,
    S3Client,
} from "@aws-sdk/client-s3";

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

export const getS3Object = async (input: GetObjectCommandInput) => client.send(new GetObjectCommand(input));
export const putS3Object = async (input: PutObjectCommandInput) => client.send(new PutObjectCommand(input));
