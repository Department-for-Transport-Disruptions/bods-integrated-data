import { writeFileSync } from "node:fs";
import { S3Client } from "@aws-sdk/client-s3";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { Command } from "commander";
import { asString, generateCsv, mkConfig } from "export-to-csv";
import { Stats } from "fast-stats";
import { STAGES, STAGE_OPTION, listS3Objects, listS3ObjectsByCommonPrefix, withUserPrompts } from "../utils";

type Dayjs = ReturnType<typeof getDate>;

type FrequencyResult = {
    subscription_id: string;
    mean: string;
    median: string;
    "50th_percentile": string;
    "95th_percentile": string;
    "99th_percentile": string;
    range: string;
};

type DateOptions = {
    dateString: string;
    startThreshold: Dayjs;
    endThreshold: Dayjs;
};

const getDateTimesForSubscription = async (
    s3Client: S3Client,
    bucketName: string,
    subscriptionId: string,
    dateOptions: DateOptions,
) => {
    const directory = `${subscriptionId}/`;
    const keyPrefix = `${directory}${dateOptions.dateString}`;

    const objects = await listS3Objects(s3Client, bucketName, keyPrefix);
    const dateTimes: Dayjs[] = [];

    for (const object of objects) {
        if (object.Key) {
            const objectDateString = object.Key.replaceAll("_", ":").substring(
                directory.length,
                object.Key.lastIndexOf("."),
            );

            const objectDate = getDate(objectDateString);

            if (
                objectDate.isSameOrAfter(dateOptions.startThreshold) &&
                objectDate.isSameOrBefore(dateOptions.endThreshold)
            ) {
                dateTimes.push(objectDate);
            }
        }
    }

    return dateTimes;
};

const generateFrequencyResult = (subscriptionId: string, dateTimes: Dayjs[]): FrequencyResult => {
    const deltas = new Stats();

    for (let i = 0; i < dateTimes.length; i++) {
        if (i > 0) {
            const delta = dateTimes[i].diff(dateTimes[i - 1], "milliseconds") / 1000;
            deltas.push(delta);
        }
    }

    return {
        subscription_id: subscriptionId,
        mean: deltas.amean().toFixed(1),
        median: deltas.median().toFixed(1),
        "50th_percentile": deltas.percentile(50).toFixed(1),
        "95th_percentile": deltas.percentile(95).toFixed(1),
        "99th_percentile": deltas.percentile(99).toFixed(1),
        range: deltas.range().join("-"),
    };
};

const generateResultsFile = (dateString: string, frequencyResults: FrequencyResult[]) => {
    if (frequencyResults.length === 0) {
        logger.info("No results to generate");
        return;
    }

    const csvConfig = mkConfig({
        quoteStrings: false,
        useKeysAsHeaders: true,
    });

    const csv = generateCsv(csvConfig)(frequencyResults);
    const csvBuffer = new Uint8Array(Buffer.from(asString(csv)));
    const filename = `avl-frequencies-${dateString}.csv`;
    writeFileSync(filename, csvBuffer);

    logger.info(`Results written to ${filename}`);
};

export const analyseAvlFrequency = new Command("analyse-avl-frequency")
    .addOption(STAGE_OPTION)
    .option("-d, --date <date>", "Date as YYYY-MM-DD")
    .action(async (options) => {
        const { stage, date: dateString } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            date: { type: "input", default: getDate().format("YYYY-MM-DD") },
        });

        if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateString)) {
            logger.error("Date must be in format YYYY-MM-DD");
            return;
        }

        const date = getDate(dateString);
        const dateOptions: DateOptions = {
            dateString,
            startThreshold: date.startOf("day").add(8, "hours"),
            endThreshold: date.startOf("day").add(20, "hours"),
        };

        const bucketName = `integrated-data-avl-raw-siri-vm-${stage}`;
        const frequencyResults: FrequencyResult[] = [];
        let subscriptionCount = 0;

        const s3Client = new S3Client({
            region: "eu-west-2",
            ...(stage === "local"
                ? {
                      endpoint: "http://localhost:4566",
                      credentials: {
                          accessKeyId: "DUMMY",
                          secretAccessKey: "DUMMY",
                      },
                  }
                : {}),
        });

        try {
            logger.info(`Fetching subscription IDs for bucket ${bucketName}`);

            const commonPrefixes = await listS3ObjectsByCommonPrefix(s3Client, bucketName, "/");
            const subscriptionIds = commonPrefixes.map((commonPrefix) => (commonPrefix.Prefix || "").slice(0, -1));
            subscriptionCount = subscriptionIds.length;

            for (let i = 0; i < subscriptionCount; i++) {
                const subscriptionId = subscriptionIds[i];
                logger.info(`Checking subscription ${i + 1}/${subscriptionCount} (ID: ${subscriptionId})`);

                const dateTimes = await getDateTimesForSubscription(s3Client, bucketName, subscriptionId, dateOptions);

                if (dateTimes.length > 0) {
                    const frequencyResult = generateFrequencyResult(subscriptionId, dateTimes);
                    frequencyResults.push(frequencyResult);
                }
            }
        } catch (e) {
            logger.error(e, "Error processing S3 objects");
            s3Client.destroy();
        }

        logger.info(`${frequencyResults.length}/${subscriptionCount} subscriptions have results to analyse`);

        generateResultsFile(dateOptions.dateString, frequencyResults);
    });
