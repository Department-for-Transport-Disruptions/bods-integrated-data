import { logger } from "@baselime/lambda-logger";
import { putParameter } from "../ssm";
import {
    AvlSubscription,
    avlSubscriptionRequestSchema,
    avlSubscriptionResponseSchema,
    AvlSubscriptionStatuses,
} from "../schema/avl-subscribe.schema";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { putDynamoItem } from "../dynamo";
import { getDate } from "../dates";
import { randomUUID } from "node:crypto";
import axios from "axios";
import { getSiriVmTerminationTimeOffset } from "./utils";

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
) => {
    const subscriptionRequestJson = {
        SubscriptionRequest: {
            RequestTimestamp: currentTimestamp,
            ConsumerAddress: `${dataEndpoint}/${subscriptionId}`,
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
                },
            },
        },
    };

    const verifiedSubscriptionRequest = avlSubscriptionRequestSchema.parse(subscriptionRequestJson);

    const completeObject = {
        "?xml": {
            "#text": "",
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:ns2": "http://www.ifopt.org.uk/acsb",
            "@_xmlns:ns3": "http://www.ifopt.org.uk/ifopt",
            "@_xmlns:ns4": "http://datex2.eu/schema/2_0RC1/2_0",
            SubscriptionRequest: {
                ...verifiedSubscriptionRequest.SubscriptionRequest,
                VehicleMonitoringSubscriptionRequest: {
                    ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest,
                    VehicleMonitoringRequest: {
                        "@_version": "2.0",
                        ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest
                            .VehicleMonitoringRequest,
                    },
                },
            },
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

    const parsedJson = avlSubscriptionResponseSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error(
            `There was an error parsing the subscription response from the data producer with subscription ID: ${subscriptionId}`,
            parsedJson.error.format(),
        );
        return null;
    }

    return parsedJson.data;
};

export const updateDynamoWithSubscriptionInfo = async (
    tableName: string,
    subscriptionId: string,
    subscription: Omit<AvlSubscription, "PK" | "status">,
    status: AvlSubscriptionStatuses,
    currentTimestamp?: string,
) => {
    const subscriptionTableItems: Omit<AvlSubscription, "PK"> = {
        url: subscription.url,
        status: status,
        description: subscription.description,
        shortDescription: subscription.shortDescription,
        requestorRef: subscription.requestorRef ?? null,
        serviceStartDatetime: currentTimestamp ?? null,
        publisherId: subscription.publisherId ?? null,
    };

    logger.info("Updating DynamoDB with subscription information");

    await putDynamoItem(tableName, subscriptionId, "SUBSCRIPTION", subscriptionTableItems);
};

export const sendSubscriptionRequestAndUpdateDynamo = async (
    subscriptionId: string,
    subscription: Omit<AvlSubscription, "PK" | "status">,
    username: string,
    password: string,
    tableName: string,
    dataEndpoint: string,
    mockProducerSubscribeEndpoint?: string,
) => {
    const requestTime = getDate();
    const currentTime = requestTime.toISOString();
    const initialTerminationTime = getSiriVmTerminationTimeOffset(requestTime);

    const messageIdentifier = randomUUID();

    const subscriptionRequestMessage = generateSubscriptionRequestXml(
        subscriptionId,
        currentTime,
        initialTerminationTime,
        messageIdentifier,
        dataEndpoint,
        subscription.requestorRef ?? null,
    );

    const url =
        mockProducerSubscribeEndpoint && subscription.requestorRef === "BODS_MOCK_PRODUCER"
            ? mockProducerSubscribeEndpoint
            : subscription.url;

    const subscriptionResponse = await axios.post<string>(url, subscriptionRequestMessage, {
        headers: {
            "Content-Type": "text/xml",
            Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
    });

    const subscriptionResponseBody = subscriptionResponse.data;

    if (!subscriptionResponseBody) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscription, "ERROR");
        throw new Error(`No response body received from the data producer: ${subscription.url}`);
    }

    const parsedResponseBody = parseXml(subscriptionResponseBody, subscriptionId);

    if (!parsedResponseBody) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscription, "ERROR");
        throw new Error(`Error parsing subscription response from: ${subscription.url}`);
    }

    if (!parsedResponseBody.SubscriptionResponse.ResponseStatus.Status) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscription, "ERROR");
        throw new Error(`The data producer: ${subscription.url} did not return a status of true.`);
    }

    await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscription, "LIVE", currentTime);
};
