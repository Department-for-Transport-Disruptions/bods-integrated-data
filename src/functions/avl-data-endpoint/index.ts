import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { XMLValidator } from "fast-xml-parser";
import { parseString } from "xml2js";
import { ClientError } from "./errors";

interface DynamoDBValues {
    subscriberID: string;
    timeStamp: string;
    eventHeartbeatFlag: boolean;
}

interface HeartbeatNotificationEvent {
    HeartbeatNotification?: HeartbeatNotification;
}

interface HeartbeatNotification {
    RequestTimestamp: string[];
    ProducerRef: string[];
    Status: string[];
    ServiceStartedTime: string[];
}

export const validateXmlAndUploadToS3 = async (
    xml: string,
    bucketName: string,
    subscriptionId: string,
    tableName: string,
) => {
    const currentTime = getDate();
    const result = XMLValidator.validate(xml, {
        allowBooleanAttributes: true,
    });
    if (result !== true) {
        throw new ClientError();
    }
    logger.info("Valid XML");
    const dynamoDBValues: DynamoDBValues = getDynamoDBValues(xml);
    const checkHeartBeat: boolean = dynamoDBValues.eventHeartbeatFlag;
    if (!checkHeartBeat) {
        logger.info("Not a hearbeart notification");
        await putS3Object({
            Bucket: bucketName,
            Key: `${subscriptionId}/${currentTime.toISOString()}`,
            ContentType: "application/xml",
            Body: xml,
        });
        logger.info("Successfully uploaded SIRI-VM to S3");
    }
    if (checkHeartBeat) {
        logger.info("This is a HeartBeat Notification");
        const subscriptionTableItems = {
            HeartbeatLastRecievedDateTime: dynamoDBValues.timeStamp,
        };
        logger.info("Updating DynamoDB with subscription information");

        await putDynamoItem(tableName, dynamoDBValues.subscriberID, "SUBSCRIPTION", subscriptionTableItems);
    }
};

export const getDynamoDBValues = (xml: string): DynamoDBValues => {
    let eventJson: HeartbeatNotificationEvent = {};
    let eventHeartbeatFlag = false as boolean;
    parseString(xml, function (err: unknown, results: unknown) {
        const data = JSON.stringify(results);
        eventJson = JSON.parse(data) as HeartbeatNotificationEvent;
    });
    if (eventJson.hasOwnProperty("HeartbeatNotification")) {
        eventHeartbeatFlag = true as boolean;
    }
    const dynamoDBValues: DynamoDBValues = {
        eventHeartbeatFlag: eventHeartbeatFlag,
        subscriberID: eventJson.HeartbeatNotification?.ProducerRef[0] || "",
        timeStamp: eventJson.HeartbeatNotification?.RequestTimestamp[0] || "",
    };

    return dynamoDBValues;
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;
        const { TABLE_NAME: tableName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }
        if (!tableName) {
            throw new Error("Missing env var: TABLE_NAME must be set.");
        }

        const subscriptionId = event?.pathParameters?.subscriptionId;

        if (!subscriptionId) {
            throw new Error("Subscription ID missing from path parameters");
        }

        logger.info("Starting Data Endpoint");

        if (!event.body) {
            throw new Error("No body sent with event");
        }
        await validateXmlAndUploadToS3(event.body, bucketName, subscriptionId, tableName);
        return {
            statusCode: 200,
        };
    } catch (e) {
        if (e instanceof ClientError) {
            logger.warn("Invalid XML provided.", e);
            return { statusCode: 400 };
        }
        if (e instanceof Error) {
            logger.error("There was a problem with the Data endpoint", e);
        }
        throw e;
    }
};
