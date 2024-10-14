import { KyselyDb, NewSituation } from "../database";
import { getDynamoItem, recursiveScan } from "../dynamo";
import {
    CancellationsSubscription,
    cancellationsSubscriptionSchema,
    cancellationsSubscriptionsSchema,
} from "../schema/cancellations-subscribe.schema";
import { SubscriptionIdNotFoundError, chunkArray,runXmlLint, } from "../utils";
import commandExists from "command-exists";
import { getDate } from "../dates";
import { putS3Object } from "../s3";
import { GENERATED_SIRI_VM_FILE_PATH} from "../avl/utils";
import { Dayjs } from "dayjs";
import { SiriVehicleActivity } from "../schema";
import { putMetricData } from "../cloudwatch";
import { logger } from "../logger";

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

export const insertSituations = async (dbClient: KyselyDb, cancellations: NewSituation[]) => {
    const insertChunks = chunkArray(cancellations, 1000);

    await Promise.all(
        insertChunks.map((chunk) =>
            dbClient
                .insertInto("situation")
                .values(chunk)
                .onConflict((oc) =>
                    oc.column("id").doUpdateSet((eb) => ({
                        subscription_id: eb.ref("excluded.subscription_id"),
                        response_time_stamp: eb.ref("excluded.response_time_stamp"),
                        producer_ref: eb.ref("excluded.producer_ref"),
                        situation_number: eb.ref("excluded.situation_number"),
                        version: eb.ref("excluded.version"),
                        situation: eb.ref("excluded.situation"),
                    })),
                )
                .execute(),
        ),
    );
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
