import { getDate } from "@bods-integrated-data/shared/dates";
import { recursiveScan } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { observationsSchema } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const getObservations = async (tableName: string) => {
    const observations = await recursiveScan({
        TableName: tableName,
    });

    if (!observations) {
        return [];
    }

    return observationsSchema.parse(observations);
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TNDS_ANALYSIS_TABLE_NAME, TNDS_ANALYSIS_BUCKET_NAME } = process.env;

    if (!TNDS_ANALYSIS_TABLE_NAME || !TNDS_ANALYSIS_BUCKET_NAME) {
        throw new Error("Missing env vars - TNDS_ANALYSIS_TABLE_NAME and TNDS_ANALYSIS_BUCKET_NAME must be set");
    }

    logger.info(`temp log - event info: ${JSON.stringify(event)}`);

    const observations = await getObservations(TNDS_ANALYSIS_TABLE_NAME);
    logger.info(`Creating report with ${observations.length} observations`);

    const csvRows = observations.map((observation) => ({
        filename: observation.PK,
        importance: observation.importance,
        category: observation.category,
        observation: observation.observation,
        registrationNumber: observation.registrationNumber,
        service: observation.service,
        details: observation.details,
    }));

    const csvHeaders = [
        "filename",
        "importance",
        "category",
        "observation",
        "registrationNumber",
        "service",
        "details",
    ];

    let csvContent = `\uffef${csvHeaders.join(",")}\r\n`;

    if (csvRows.length) {
        csvContent += `${csvRows.map((row) => Object.values(row).join(",")).join("\r\n")}\r\n`;
    }

    const date = getDate().format("YYYYMMDD");

    await putS3Object({
        Bucket: TNDS_ANALYSIS_BUCKET_NAME,
        Key: `${date}.csv`,
        ContentType: "text/csv",
        Body: csvContent,
    });
};
