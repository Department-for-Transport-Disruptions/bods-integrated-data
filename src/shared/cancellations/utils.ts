import { getDynamoItem, recursiveScan } from "../dynamo";
import {
    CancellationsSubscription,
    cancellationsSubscriptionSchema,
    cancellationsSubscriptionsSchema,
} from "../schema/cancellations-subscribe.schema";
import { runXmlLint, SubscriptionIdNotFoundError } from "../utils";
import { Avl } from "../database";
import commandExists from "command-exists";
import { getDate } from "../dates";
import { tflOperatorRef } from "../constants";
import { putS3Object } from "../s3";
import { createVehicleActivities, GENERATED_SIRI_VM_FILE_PATH, GENERATED_SIRI_VM_TFL_FILE_PATH } from "../avl/utils";
import { Dayjs } from "dayjs";
import { SiriVehicleActivity } from "../schema";
import { putMetricData } from "../cloudwatch";
import { logger } from "../logger";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

export const getCancellationsSubscriptions = async (tableName: string) => {
    const subscriptions = await recursiveScan({
        TableName: tableName,
    });

    if (!subscriptions) {
        return [];
    }

    return cancellationsSubscriptionsSchema.parse(subscriptions);
};

export const getCancellationsSubscription = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem<CancellationsSubscription>(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        throw new SubscriptionIdNotFoundError(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return cancellationsSubscriptionSchema.parse(subscription);
};

/**
 * Map database Situations to SIRI-SX PtSituationElements, stripping any invalid characters as necessary. Characters are stripped here to
 * preserve the original incoming data in the database, but to format for our generated SIRI-SX output.
 * @param PtSituationElements situations from DB
 * @param validUntilTime Valid until time
 * @returns mapped SIRI-SX Situations
 */
const createSituations = (PtSituationElements:any, responseTime: Dayjs) => {
// TODO Map to situation element and run a cleanDeep
}

const createSiriSx = (
    situations: Partial<SiriVehicleActivity>[],
    requestMessageRef: string,
    responseTime: Dayjs,
) => {
    //TODO create SIRI-SX JSON object here and build it as XML
}

const createAndValidateSiriSx = async (
    situations: any,
    requestMessageRef: string,
    responseTime: Dayjs,
    lintSiri: boolean,
    ) => {
    const siriSx = createSiriSx(situations, requestMessageRef, responseTime)


    if (lintSiri) {
        try {
            await runXmlLint(siriSx);
        } catch (e) {
            await putMetricData("custom/SiriSxGenerator", [
                { MetricName: "ValidationError", Value: 1 },
            ]);

            logger.error(e);

            throw e;
        }
    }

    return siriSx;
}

export const generateSiriSxAndUploadToS3 = async (
    PtSituationElements: any,
    requestMessageRef: string,
    bucketName: string,
    lintSiri = true,
) => {
    if (lintSiri && !commandExists("xmllint")) {
        throw new Error("xmllint not available");
    }

    const responseTime = getDate();

    const situations = createSituations(PtSituationElements, responseTime);

    const siriSx = await createAndValidateSiriSx(situations, requestMessageRef, responseTime, lintSiri),

    await Promise.all([
        putS3Object({
            Bucket: bucketName,
            Key: GENERATED_SIRI_VM_FILE_PATH,
            ContentType: "application/xml",
            Body: siriSx,
        }),
    ]);
};
