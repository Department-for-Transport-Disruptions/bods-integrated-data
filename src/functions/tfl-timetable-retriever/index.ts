import { Readable } from "node:stream";
import {
    CommonPrefix,
    GetObjectCommand,
    ListObjectsV2Command,
    ListObjectsV2CommandInput,
    S3Client,
    _Object,
} from "@aws-sdk/client-s3";
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

const listTfLS3Objects = async (client: S3Client, commandInput: ListObjectsV2CommandInput) => {
    const objects: _Object[] = [];
    const commonPrefixes: CommonPrefix[] = [];
    let isTruncated = undefined;
    let startAfterKey = undefined;

    do {
        const response = await client.send(
            new ListObjectsV2Command({
                ...commandInput,
                StartAfter: startAfterKey,
            }),
        );

        if (response.Contents) {
            objects.push(...response.Contents);

            startAfterKey = objects[objects.length - 1].Key;
        }

        if (response.CommonPrefixes) {
            commonPrefixes.push(...response.CommonPrefixes);
        }

        isTruncated = response.IsTruncated;
    } while (isTruncated);

    return { objects, commonPrefixes };
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

        const tflBaseVersionObjects = await listTfLS3Objects(tflS3Client, {
            Bucket: TFL_IBUS_BUCKET_NAME,
            Delimiter: "/",
        });

        const mostRecentTimetablePrefix = getPrefixWithLatestDate(
            tflBaseVersionObjects.commonPrefixes.map((prefix) => prefix.Prefix ?? ""),
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

        const tflTimetableObjects = await listTfLS3Objects(tflS3Client, {
            Bucket: TFL_IBUS_BUCKET_NAME,
            Prefix: mostRecentTimetablePrefix,
        });

        logger.info(`Retrieving ${tflTimetableObjects.objects.length} files`);

        for await (const { Key } of tflTimetableObjects.objects) {
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
