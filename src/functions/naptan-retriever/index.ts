import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import { randomUUID } from "crypto";
import * as logger from "lambda-log";

const s3Client = new S3Client({
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

export const handler = async () => {
    logger.options.dev = process.env.NODE_ENV !== "production";
    logger.options.debug =
        process.env.ENABLE_DEBUG_LOGS === "true" ||
        process.env.NODE_ENV !== "production";

    logger.options.meta = {
        id: randomUUID(),
    };

    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        logger.info("Starting naptan retriever");

        const response = await axios.get(
            "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv",
            {
                responseType: "arraybuffer",
            }
        );

        logger.info("Data retrieved");

        await s3Client.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: "Stops.csv",
                ContentType: "text/csv",
                Body: response.data as string,
            })
        );

        logger.info("Naptan retriever successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the naptan retriever");
            logger.error(e);
        }

        throw e;
    }
};
