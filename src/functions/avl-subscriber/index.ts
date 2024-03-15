import { logger } from "@baselime/lambda-logger";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { putParameter } from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent } from "aws-lambda";
import { parse } from "js2xmlparser";
import { parseStringPromise } from "xml2js";
import { parseBooleans } from "xml2js/lib/processors";
import { randomUUID } from "crypto";
import {
    AvlSubscribeMessage,
    avlSubscribeMessageSchema,
    subscriptionRequestSchema,
    subscriptionResponseSchema,
} from "./subscriber.schema";

export const generateSubscriptionRequestXml = (
    avlSubscribeMessage: AvlSubscribeMessage,
    subscriptionId: string,
    currentTimestamp: string,
    initialTerminationTime: string,
    messageIdentifier: string,
) => {
    const subscriptionRequestJson = {
        SubscriptionRequest: {
            RequestTimeStamp: currentTimestamp,
            Address: `${avlSubscribeMessage.dataProducerEndpoint}/${subscriptionId}`,
            RequestorRef: avlSubscribeMessage.requestorRef ?? "BODS",
            MessageIdentifier: messageIdentifier,
            SubscriptionRequestContext: {
                HeartbeatInterval: "PT30M",
            },
            VehicleMonitoringSubscriptionRequest: {
                SubscriberRef: "BODS",
                SubscriptionIdentifier: subscriptionId,
                InitialTerminationTime: initialTerminationTime,
                VehicleMonitoringRequest: {
                    RequestTimestamp: currentTimestamp,
                },
            },
        },
    };

    const verifiedSubscriptionRequest = subscriptionRequestSchema.parse(subscriptionRequestJson);

    const completeObject = {
        "@": {
            version: "2.0",
            xmlns: "http://www.siri.org.uk/siri",
            "xmlns:ns2": "http://www.ifopt.org.uk/acsb",
            "xmlns:ns3": "http://www.ifopt.org.uk/ifopt",
            "xmlns:ns4": "http://datex2.eu/schema/2_0RC1/2_0",
        },
        "#": {
            SubscriptionRequest: {
                ...verifiedSubscriptionRequest.SubscriptionRequest,
                VehicleMonitoringSubscriptionRequest: {
                    ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest,
                    VehicleMonitoringRequest: {
                        "@": {
                            version: "2.0",
                        },
                        "#": {
                            ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest
                                .VehicleMonitoringRequest,
                        },
                    },
                },
            },
        },
    };

    return parse("Siri", completeObject, {
        declaration: {
            version: "1.0",
            encoding: "UTF-8",
            standalone: "yes",
        },
        useSelfClosingTagIfEmpty: true,
    });
};

const parseXml = async (xml: string) => {
    const parsedXml = (await parseStringPromise(xml, {
        explicitArray: false,
        valueProcessors: [parseBooleans],
        ignoreAttrs: true,
    })) as Record<string, object>;

    const parsedJson = subscriptionResponseSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error(
            "There was an error parsing the subscription response from the data producer",
            parsedJson.error.format(),
        );

        throw new Error("Error parsing data");
    }

    return parsedJson.data;
};

const updateDynamoWithSubscriptionInfo = async (
    tableName: string,
    subscriptionId: string,
    avlSubscribeMessage: AvlSubscribeMessage,
    status: "ACTIVE" | "FAILED",
) => {
    const subscriptionTableItems = {
        url: avlSubscribeMessage.dataProducerEndpoint,
        status: status,
        description: avlSubscribeMessage.description,
        shortDescription: avlSubscribeMessage.description,
        requestorRef: avlSubscribeMessage.requestorRef ?? null,
    };

    logger.info("Updating DynamoDB with subscription information");

    await putDynamoItem(tableName, subscriptionId, "SUBSCRIPTION", subscriptionTableItems);
};

const addSubscriptionAuthCredsToSsm = async (subscriptionId: string, username: string, password: string) => {
    logger.info("Uploading subscription auth credentials to parameter store");

    await Promise.all([
        putParameter(`subscription/${subscriptionId}/username`, username, "SecureString", true),
        putParameter(`subscription/${subscriptionId}/password`, password, "SecureString", true),
    ]);
};

const sendSubscriptionRequestAndUpdateDynamo = async (
    subscriptionId: string,
    avlSubscribeMessage: AvlSubscribeMessage,
    tableName: string,
) => {
    const currentTimestamp = getDate().toISOString();
    // Initial termination time for a SIRI-VM subscription request is defined as 10 years after the current time
    const initialTerminationTime = addIntervalToDate(currentTimestamp, 10, "years").toISOString();

    const messageIdentifier = randomUUID();

    const subscriptionRequestMessage = generateSubscriptionRequestXml(
        avlSubscribeMessage,
        subscriptionId,
        currentTimestamp,
        initialTerminationTime,
        messageIdentifier,
    );

    const subscriptionResponse = await fetch(`${avlSubscribeMessage.dataProducerEndpoint}/${subscriptionId}`, {
        method: "POST",
        body: subscriptionRequestMessage,
    });

    if (!subscriptionResponse.ok) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "FAILED");
        throw new Error(
            `There was an error when sending the subscription request to the data producer: ${avlSubscribeMessage.dataProducerEndpoint}, status code: ${subscriptionResponse.status}`,
        );
    }

    const subscriptionResponseBody = await subscriptionResponse.text();

    if (!subscriptionResponseBody) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "FAILED");
        throw new Error(
            `No response body received from the data producer: ${avlSubscribeMessage.dataProducerEndpoint}`,
        );
    }

    const parsedResponseBody = await parseXml(subscriptionResponseBody);

    if (!parsedResponseBody.SubscriptionResponse.ResponseStatus.Status) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "FAILED");
        throw new Error(
            `The data producer: ${avlSubscribeMessage.dataProducerEndpoint} did not return a status of true.`,
        );
    }

    await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "ACTIVE");
};

export const handler = async (event: APIGatewayEvent) => {
    try {
        const { TABLE_NAME: tableName } = process.env;

        if (!tableName) {
            throw new Error("Missing env var: TABLE_NAME must be set.");
        }

        logger.info("Starting AVL subscriber");

        const parsedBody = avlSubscribeMessageSchema.safeParse(JSON.parse(event.body ?? ""));

        if (!parsedBody.success) {
            logger.error(JSON.stringify(parsedBody.error));
            throw new Error("Invalid subscribe message from event body.");
        }

        const avlSubscribeMessage = parsedBody.data;

        const subscriptionId = randomUUID();

        // Add username and password to parameter store
        await addSubscriptionAuthCredsToSsm(subscriptionId, avlSubscribeMessage.username, avlSubscribeMessage.password);

        await sendSubscriptionRequestAndUpdateDynamo(subscriptionId, avlSubscribeMessage, tableName);

        logger.info(`Successfully subscribed to data producer: ${avlSubscribeMessage.dataProducerEndpoint}.`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", e);

            throw e;
        }

        throw e;
    }
};
