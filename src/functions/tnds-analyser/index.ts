import { randomUUID } from "node:crypto";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const dummyObservation: Observation[] = [
    {
        PK: "20240502/EA/cambs_A2BR_114_20114_.xml",
        SK: randomUUID(),
        importance: "critical",
        category: "timing",
        observation: "No timing point for more than 15 minutes",
        registrationNumber: "registrationNumber",
        service: "TEST",
        details: "detailed description of observation",
    },
    {
        PK: "20240502/EA/cambs_A2BR_114_20114_.xml",
        SK: randomUUID(),
        importance: "critical",
        category: "journey",
        observation: "Missing journey code",
        registrationNumber: "registrationNumber",
        service: "TEST",
        details: "detailed description of observation",
    },
    {
        PK: "20240502/EA/cambs_A2BR_114_20114_.xml",
        SK: randomUUID(),
        importance: "critical",
        category: "stop",
        observation: "Incorrect stop type",
        registrationNumber: "registrationNumber",
        service: "TEST",
        details: "detailed description of observation",
    },
];

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    const { TABLE_NAME: tableName } = process.env;

    if (!tableName) {
        throw new Error("Missing env vars - TABLE_NAME must be set");
    }

    logger.info("tnds-analyser stub function");

    await putDynamoItems(tableName, dummyObservation);
};
