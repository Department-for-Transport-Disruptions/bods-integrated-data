import { PassThrough } from "node:stream";
import { getDate } from "@bods-integrated-data/shared/dates";
import { scanDynamo } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { startS3Upload } from "@bods-integrated-data/shared/s3";
import { dynamoDbObservationSchema } from "@bods-integrated-data/shared/tnds-analyser/schema";
import archiver from "archiver";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

type ObservationSummaryByDataSource = {
    "Dataset Date": string;
    "Data Source": string;
    "Total observations": number;
    "Critical observations": number;
    "Advisory observations": number;
    "No timing point for more than 15 minutes": number;
    "First stop is not a timing point": number;
    "Last stop is not a timing point": number;
    "Last stop is pick up only": number;
    "First stop is set down only": number;
    "Stop not found in NaPTAN": number;
    "Incorrect stop type": number;
    "Missing journey code": number;
    "Duplicate journey code": number;
    "Duplicate journey": number;
    "Missing bus working number": number;
    "Serviced organisation out of date": number;
};

type ObservationSummaryByFile = {
    "Dataset Date": string;
    Region: string;
    File: string;
    "Data Source": string;
    "Total observations": number;
    "Critical observations": number;
    "Advisory observations": number;
    "No timing point for more than 15 minutes": number;
    "First stop is not a timing point": number;
    "Last stop is not a timing point": number;
    "Last stop is pick up only": number;
    "First stop is set down only": number;
    "Stop not found in NaPTAN": number;
    "Incorrect stop type": number;
    "Missing journey code": number;
    "Duplicate journey code": number;
    "Duplicate journey": number;
    "Missing bus working number": number;
    "Serviced organisation out of date": number;
};

type ObservationSummaryByObservationType = {
    "Dataset Date": string;
    Region: string;
    File: string;
    "National Operator Code": string;
    "Line Name": string;
    Quantity: number;
};

const createCsv = <T extends Record<string, U>, U>(data: T[]) => {
    if (!data.length) {
        return null;
    }

    const dataRows = data.map((row) =>
        Object.values(row)
            .map((value) => (typeof value === "string" ? value.replaceAll(",", "") : value))
            .join(","),
    );

    return `${Object.keys(data[0]).join(",")}\r\n${dataRows.join("\r\n")}\r\n`;
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_OBSERVATION_TABLE_NAME, TNDS_ANALYSIS_BUCKET_NAME } = process.env;

    if (!TNDS_OBSERVATION_TABLE_NAME || !TNDS_ANALYSIS_BUCKET_NAME) {
        throw new Error("Missing env vars - TNDS_OBSERVATION_TABLE_NAME and TNDS_ANALYSIS_BUCKET_NAME must be set");
    }

    const date = event.date;
    const formattedDate = getDate(date).format("DD/MM/YYYY");
    const observationByDataSourceMap: Record<string, ObservationSummaryByDataSource> = {};
    const observationByFileMap: Record<string, ObservationSummaryByFile> = {};
    const observationByObservationTypesMap: Record<string, Record<string, ObservationSummaryByObservationType>> = {};
    const criticalObservationByObservationTypesMap: Record<
        string,
        Record<string, ObservationSummaryByObservationType>
    > = {};

    let dynamoScanStartKey: Record<string, string> | undefined = undefined;

    do {
        const dynamoScanOutput = await scanDynamo({
            TableName: TNDS_OBSERVATION_TABLE_NAME,
            ExclusiveStartKey: dynamoScanStartKey,
        });
        dynamoScanStartKey = dynamoScanOutput.LastEvaluatedKey;

        if (dynamoScanOutput.Items) {
            for (const item of dynamoScanOutput.Items) {
                try {
                    const observation = dynamoDbObservationSchema.parse(item);
                    const dataSource = observation.dataSource;
                    const filepath = observation.PK;
                    const filename = filepath.substring(filepath.indexOf("/") + 1);
                    const observationType = observation.observation;

                    if (!observationByDataSourceMap[dataSource]) {
                        observationByDataSourceMap[dataSource] = {
                            "Dataset Date": formattedDate,
                            "Data Source": dataSource,
                            "Total observations": 0,
                            "Critical observations": 0,
                            "Advisory observations": 0,
                            "No timing point for more than 15 minutes": 0,
                            "First stop is not a timing point": 0,
                            "Last stop is not a timing point": 0,
                            "Last stop is pick up only": 0,
                            "First stop is set down only": 0,
                            "Stop not found in NaPTAN": 0,
                            "Incorrect stop type": 0,
                            "Missing journey code": 0,
                            "Duplicate journey code": 0,
                            "Duplicate journey": 0,
                            "Missing bus working number": 0,
                            "Serviced organisation out of date": 0,
                        };
                    }

                    observationByDataSourceMap[dataSource]["Total observations"]++;
                    observationByDataSourceMap[dataSource][observationType]++;

                    if (observation.importance === "critical") {
                        observationByDataSourceMap[dataSource]["Critical observations"]++;
                    } else {
                        observationByDataSourceMap[dataSource]["Advisory observations"]++;
                    }

                    if (!observationByFileMap[filepath]) {
                        observationByFileMap[filepath] = {
                            "Dataset Date": formattedDate,
                            Region: observation.region,
                            File: filename,
                            "Data Source": dataSource,
                            "Total observations": 0,
                            "Critical observations": 0,
                            "Advisory observations": 0,
                            "No timing point for more than 15 minutes": 0,
                            "First stop is not a timing point": 0,
                            "Last stop is not a timing point": 0,
                            "Last stop is pick up only": 0,
                            "First stop is set down only": 0,
                            "Stop not found in NaPTAN": 0,
                            "Incorrect stop type": 0,
                            "Missing journey code": 0,
                            "Duplicate journey code": 0,
                            "Duplicate journey": 0,
                            "Missing bus working number": 0,
                            "Serviced organisation out of date": 0,
                        };
                    }

                    observationByFileMap[filepath]["Total observations"]++;
                    observationByFileMap[filepath][observationType]++;

                    if (observation.importance === "critical") {
                        observationByFileMap[filepath]["Critical observations"]++;
                    } else {
                        observationByFileMap[filepath]["Advisory observations"]++;
                    }

                    if (!observationByObservationTypesMap[observationType]) {
                        observationByObservationTypesMap[observationType] = {};
                    }

                    if (!observationByObservationTypesMap[observationType][filepath]) {
                        observationByObservationTypesMap[observationType][filepath] = {
                            "Dataset Date": formattedDate,
                            Region: observation.region,
                            File: filename,
                            "National Operator Code": observation.noc,
                            "Line Name": observation.service,
                            Quantity: 0,
                        };
                    }

                    observationByObservationTypesMap[observationType][filepath].Quantity++;

                    if (observation.importance === "critical") {
                        if (!criticalObservationByObservationTypesMap[observationType]) {
                            criticalObservationByObservationTypesMap[observationType] = {};
                        }

                        const observationKey = `${observation.PK}#${observation.SK}`;

                        criticalObservationByObservationTypesMap[observationType][observationKey] = {
                            "Dataset Date": formattedDate,
                            Region: observation.region,
                            File: filename,
                            "National Operator Code": observation.noc,
                            "Line Name": observation.service,
                            Quantity: 1,
                            ...observation.extraColumns,
                        };
                    }
                } catch (error) {
                    logger.error(error, "Error parsing dynamo item");
                }
            }
        }
    } while (dynamoScanStartKey);

    const archive = archiver("zip", {});

    try {
        const passThrough = new PassThrough();
        archive.pipe(passThrough);
        const s3Upload = startS3Upload(TNDS_ANALYSIS_BUCKET_NAME, `${date}.zip`, passThrough, "application/zip");

        const observationByDataSourceItemsCsv = createCsv(Object.values(observationByDataSourceMap));

        if (observationByDataSourceItemsCsv) {
            archive.append(observationByDataSourceItemsCsv, { name: `${date}/observationSummariesByDataSource.csv` });
        }

        const observationByFileItemsCsv = createCsv(Object.values(observationByFileMap));

        if (observationByFileItemsCsv) {
            archive.append(observationByFileItemsCsv, { name: `${date}/observationSummariesByFile.csv` });
        }

        for (const [observationType, observationByObservationTypeMap] of Object.entries(
            observationByObservationTypesMap,
        )) {
            const observationByObservationTypeCsv = createCsv(Object.values(observationByObservationTypeMap));

            if (observationByObservationTypeCsv) {
                archive.append(observationByObservationTypeCsv, {
                    name: `${date}/observationSummariesByObservationType/${observationType}.csv`,
                });
            }
        }

        for (const [observationType, observationByObservationTypeMap] of Object.entries(
            criticalObservationByObservationTypesMap,
        )) {
            const observationByObservationTypeCsv = createCsv(Object.values(observationByObservationTypeMap));

            if (observationByObservationTypeCsv) {
                archive.append(observationByObservationTypeCsv, {
                    name: `${date}/criticalObservationsByObservationType/${observationType}.csv`,
                });
            }
        }

        await archive.finalize();
        await s3Upload.done();
    } catch (error) {
        archive.abort();
        logger.error(error, "Error creating and uploading zip file");
        throw error;
    }
};
