import { randomUUID } from "node:crypto";
import axios from "axios";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { getDate } from "../dates";
import { putDynamoItem } from "../dynamo";
import { logger } from "../logger";
import {
    AvlSubscription,
    AvlSubscriptionRequest,
    AvlSubscriptionStatus,
    avlSubscriptionResponseSchema,
} from "../schema/avl-subscribe.schema";
import { putParameter } from "../ssm";
import { CompleteSiriObject, createAuthorizationHeader, getSiriTerminationTimeOffset } from "../utils";
import { InvalidXmlError } from "../validation";

export const addSubscriptionAuthCredsToSsm = async (subscriptionId: string, username: string, password: string) => {
    logger.info("Uploading subscription auth credentials to parameter store");

    await Promise.all([
        putParameter(`/subscription/${subscriptionId}/username`, username, "SecureString", true),
        putParameter(`/subscription/${subscriptionId}/password`, password, "SecureString", true),
    ]);
};

export const generateSubscriptionRequestXml = (
    subscriptionId: string,
    currentTimestamp: string,
    initialTerminationTime: string,
    messageIdentifier: string,
    dataEndpoint: string,
    requestorRef: string | null,
    apiKey: string,
    isInternal = false,
) => {
    const subscriptionRequestJson: AvlSubscriptionRequest = {
        Siri: {
            SubscriptionRequest: {
                RequestTimestamp: currentTimestamp,
                ConsumerAddress: !isInternal
                    ? `${dataEndpoint}/${subscriptionId}?apiKey=${apiKey}`
                    : `${dataEndpoint}/${subscriptionId}`,
                RequestorRef: requestorRef ?? "BODS",
                MessageIdentifier: messageIdentifier,
                SubscriptionContext: {
                    HeartbeatInterval: "PT30S",
                },
                VehicleMonitoringSubscriptionRequest: {
                    SubscriptionIdentifier: subscriptionId,
                    InitialTerminationTime: initialTerminationTime,
                    VehicleMonitoringRequest: {
                        RequestTimestamp: currentTimestamp,
                        VehicleMonitoringDetailLevel: "normal",
                        "@_version": "2.0",
                    },
                },
            },
        },
    };

    const completeObject: CompleteSiriObject<AvlSubscriptionRequest["Siri"]> = {
        "?xml": {
            "#text": "",
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xsi:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd",
            ...subscriptionRequestJson.Siri,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        attributeNamePrefix: "@_",
    });

    const request = builder.build(completeObject) as string;

    return request;
};

const parseXml = (xml: string, subscriptionId: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: true,
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = avlSubscriptionResponseSchema.safeParse(parsedXml);

    if (!parsedJson.success) {
        logger.error(
            "There was an error parsing the subscription response from the data producer",
            parsedJson.error.format(),
        );

        throw new InvalidXmlError(`Invalid XML from subscription ID: ${subscriptionId}`);
    }

    return parsedJson.data;
};

export const updateDynamoWithSubscriptionInfo = async (
    tableName: string,
    subscriptionId: string,
    subscription: Omit<AvlSubscription, "PK" | "status">,
    status: AvlSubscriptionStatus,
    currentTimestamp?: string,
) => {
    const subscriptionTableItems: Omit<AvlSubscription, "PK"> = {
        url: subscription.url,
        status: status,
        description: subscription.description,
        shortDescription: subscription.shortDescription,
        requestorRef: subscription.requestorRef ?? null,
        serviceStartDatetime: subscription.serviceStartDatetime
            ? subscription.serviceStartDatetime
            : currentTimestamp ?? null,
        publisherId: subscription.publisherId ?? null,
        lastModifiedDateTime: currentTimestamp ?? null,
        apiKey: subscription.apiKey,
        heartbeatLastReceivedDateTime: subscription.heartbeatLastReceivedDateTime ?? null,
        lastAvlDataReceivedDateTime: subscription.lastAvlDataReceivedDateTime ?? null,
        lastResubscriptionTime: subscription.lastResubscriptionTime ?? null,
    };

    logger.info("Updating DynamoDB with subscription information");

    await putDynamoItem(tableName, subscriptionId, "SUBSCRIPTION", subscriptionTableItems);
};

export const sendSubscriptionRequestAndUpdateDynamo = async (
    subscriptionId: string,
    subscriptionDetails: Omit<AvlSubscription, "PK" | "status">,
    username: string,
    password: string,
    tableName: string,
    dataEndpoint: string,
    isInternal = false,
    mockProducerSubscribeEndpoint?: string,
) => {
    const requestTime = getDate();
    const currentTime = requestTime.toISOString();
    const initialTerminationTime = getSiriTerminationTimeOffset(requestTime);

    const messageIdentifier = randomUUID();

    const subscriptionRequestMessage = generateSubscriptionRequestXml(
        subscriptionId,
        currentTime,
        initialTerminationTime,
        messageIdentifier,
        dataEndpoint,
        subscriptionDetails.requestorRef ?? null,
        subscriptionDetails.apiKey,
        isInternal,
    );

    const url =
        mockProducerSubscribeEndpoint && subscriptionDetails.requestorRef === "BODS_MOCK_PRODUCER"
            ? mockProducerSubscribeEndpoint
            : subscriptionDetails.url;

    const subscriptionResponse = await axios.post<string>(url, subscriptionRequestMessage, {
        headers: {
            "Content-Type": "text/xml",
            ...(!isInternal ? { Authorization: createAuthorizationHeader(username, password) } : {}),
        },
    });

    const subscriptionResponseBody = subscriptionResponse.data;

    if (!subscriptionResponseBody) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "error");
        throw new Error(`No response body received from the data producer: ${subscriptionDetails.url}`);
    }

    try {
        const parsedResponseBody = parseXml(subscriptionResponseBody, subscriptionId);

        if (parsedResponseBody.Siri.SubscriptionResponse.ResponseStatus.Status !== "true") {
            await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "error");
            throw new Error(`The data producer: ${subscriptionDetails.url} did not return a status of true.`);
        }
    } catch (error) {
        if (error instanceof InvalidXmlError) {
            await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "error");
        }

        throw error;
    }

    await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "live", currentTime);
};
