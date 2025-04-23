import { Readable } from "node:stream";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { listS3Objects } from "@bods-integrated-data/shared/s3";
import { unzip } from "@bods-integrated-data/shared/unzip";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const TFL_IBUS_BUCKET_NAME = "ibus.data.tfl.gov.uk";

export const getPrefixWithLatestDate = (prefixes: string[]) => {
    const dateRegex = /(?<date>\d{8})\/$/;
    let prefixWithLatestDate: string | undefined = undefined;
    let latestDate = getDate(0);

    for (const prefix of prefixes) {
        const match = prefix.match(dateRegex);
        const dateString = match?.groups?.date;

        if (dateString) {
            const date = getDate(dateString);

            if (date > latestDate) {
                latestDate = date;
                prefixWithLatestDate = prefix;
            }
        }
    }

    return prefixWithLatestDate;
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { TFL_TIMETABLES_BUCKET_NAME } = process.env;

        if (!TFL_TIMETABLES_BUCKET_NAME) {
            throw new Error("Missing env vars - TFL_TIMETABLES_BUCKET_NAME must be set");
        }

        const tflS3Client = new S3Client({
            region: "eu-west-1",
            endpoint: "https://s3.eu-west-1.amazonaws.com",
        });

        const tflBaseVersionObjects = await tflS3Client.send(
            new ListObjectsV2Command({
                Bucket: TFL_IBUS_BUCKET_NAME,
                Delimiter: "/",
            }),
        );

        const tflBaseVersionPrefixes = tflBaseVersionObjects.CommonPrefixes || [];

        const mostRecentTimetablePrefix = getPrefixWithLatestDate(
            tflBaseVersionPrefixes.map((prefix) => prefix.Prefix ?? ""),
        );

        if (!mostRecentTimetablePrefix) {
            throw new Error("No prefixes with a valid date found in the S3 bucket");
        }

        logger.info(`Prefix with latest date: "${mostRecentTimetablePrefix}"`);

        const ourBaseVersionObjects = await listS3Objects({
            Bucket: TFL_TIMETABLES_BUCKET_NAME,
            Delimiter: "/",
        });

        const ourBaseVersionPrefixes = ourBaseVersionObjects.CommonPrefixes || [];

        for (const commonPrefix of ourBaseVersionPrefixes) {
            if (commonPrefix.Prefix === mostRecentTimetablePrefix) {
                logger.warn(`Prefix "${mostRecentTimetablePrefix}" already exists, skipping retrieval`);
                return;
            }
        }

        const tflTimetableObjects = await tflS3Client.send(
            new ListObjectsV2Command({
                Bucket: TFL_IBUS_BUCKET_NAME,
                Prefix: mostRecentTimetablePrefix,
            }),
        );

        const files = tflTimetableObjects.Contents || [];

        logger.info(`Retrieving ${files.length} files`);

        for await (const { Key } of files) {
            if (Key) {
                const object = await tflS3Client.send(
                    new GetObjectCommand({
                        Bucket: TFL_IBUS_BUCKET_NAME,
                        Key,
                    }),
                );

                if (object.Body instanceof Readable) {
                    await unzip(object.Body, TFL_TIMETABLES_BUCKET_NAME, Key);
                }
            }
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the TfL timetable retriever function");
        }

        throw e;
    }
};
