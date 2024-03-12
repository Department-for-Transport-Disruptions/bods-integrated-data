import { logger } from "@baselime/lambda-logger";
import { putS3Object, getDate } from "@bods-integrated-data/shared";
import { APIGatewayEvent } from "aws-lambda";
import { parseStringPromise } from "xml2js";
import { parseBooleans } from "xml2js/lib/processors";
import parser from "fast-xml-parser";
import { randomUUID } from "crypto";


const mockSnsEventInvalid = {
    headers: {
        "x-amz-sns-message-type": "Notification",
    },
    body: "abc",
} as unknown as APIGatewayEvent;


const mockSnsEventValid = {
    headers: {
        "x-amz-sns-message-type": "Notification",
    },
    body:
        "<?xml version='1.0' encoding='UTF-8' standalone='yes'?> <SubscriptionRequest><VehicleMonitoringSubscriptionRequest><SubscriptionIdentifier>1234</SubscriptionIdentifier></VehicleMonitoringSubscriptionRequest></SubscriptionRequest>",
} as unknown as APIGatewayEvent;

export const parseBody = async (xml: string, bucketName: string) => {
    const currentTime = getDate();
    const result = parser.validate(xml)
    // try {
    //     const result = parser.validate(xml);
    // } catch (err) {
    //     console.log(JSON.stringify(err))
    // }

    if (result === true) {
        logger.info("Valid XML");

        //  TODO this needs to be sorted after AVL subscriber

        const subId = randomUUID()
        await putS3Object({
            Bucket: bucketName,
            Key: `${subId}/${currentTime.toISOString()}`,
            ContentType: "application/xml",
            Body: xml as string,
        });
    }
    throw new Error("Not a valid XML");
};

export const handler = async (event: APIGatewayEvent) => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        logger.info("Starting Data Endpoint");

        if (!event.body) {

            throw new Error("No body sent with event");
        }
        await parseBody(event.body, bucketName);
    } catch (e) {
        if (e instanceof Error) {

            logger.error("There was a problem with the Data endpoint", e);
        }
        throw e;
    }
};