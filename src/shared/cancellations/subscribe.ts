import { randomUUID } from "node:crypto";
import axios from "axios";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { getDate } from "../dates";
import { putDynamoItem } from "../dynamo";
import { logger } from "../logger";
import {
    CancellationsSubscription,
    CancellationsSubscriptionRequest,
    CancellationsSubscriptionStatus,
    cancellationsSubscriptionResponseSchema,
} from "../schema/cancellations-subscribe.schema";
import { putParameter } from "../ssm";
import { CompleteSiriObject, createAuthorizationHeader, getSiriTerminationTimeOffset } from "../utils";
import { InvalidXmlError } from "../validation";

export const addSubscriptionAuthCredsToSsm = async (subscriptionId: string, username: string, password: string) => {
    logger.info("Uploading subscription auth credentials to parameter store");

    await Promise.all([
        putParameter(`/cancellations/subscription/${subscriptionId}/username`, username, "SecureString", true),
        putParameter(`/cancellations/subscription/${subscriptionId}/password`, password, "SecureString", true),
    ]);
};

export const generateCancellationsSubscriptionRequestXml = (
    subscriptionId: string,
    currentTimestamp: string,
    initialTerminationTime: string,
    messageIdentifier: string,
    dataEndpoint: string,
    requestorRef: string | null,
    apiKey: string,
    operatorRef: string | null,
    isInternal = false,
) => {
    const subscriptionRequestJson: CancellationsSubscriptionRequest = {
        Siri: {
            SubscriptionRequest: {
                RequestTimestamp: currentTimestamp,
                ConsumerAddress: !isInternal
                    ? `${dataEndpoint}/${subscriptionId}?apiKey=${apiKey}`
                    : `${dataEndpoint}/cancellations/${subscriptionId}`,
                RequestorRef: requestorRef ?? "BODS",
                MessageIdentifier: messageIdentifier,
                SubscriptionContext: {
                    HeartbeatInterval: "PT30S",
                },
                SituationExchangeSubscriptionRequest: {
                    SubscriberRef: subscriptionId,
                    SubscriptionIdentifier: operatorRef ? `${subscriptionId}-${operatorRef}` : subscriptionId,
                    InitialTerminationTime: initialTerminationTime,
                    SituationExchangeRequest: {
                        RequestTimestamp: currentTimestamp,
                        "@_version": "2.0",
                        ...(operatorRef ? { OperatorRef: operatorRef } : {}),
                    },
                },
                IncrementalUpdates: true,
            },
        },
    };

    const completeObject: CompleteSiriObject<CancellationsSubscriptionRequest["Siri"]> = {
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

    const parsedJson = cancellationsSubscriptionResponseSchema.safeParse(parsedXml);

    if (!parsedJson.success) {
        logger.error(
            parsedJson.error.format(),
            "There was an error parsing the subscription response from the data producer",
        );

        throw new InvalidXmlError(`Invalid XML from subscription ID: ${subscriptionId}`);
    }

    return parsedJson.data;
};

export const updateDynamoWithSubscriptionInfo = async (
    tableName: string,
    subscriptionId: string,
    subscription: Omit<CancellationsSubscription, "PK" | "status">,
    status: CancellationsSubscriptionStatus,
    currentTimestamp?: string,
) => {
    const subscriptionTableItems: Omit<CancellationsSubscription, "PK"> = {
        url: subscription.url,
        status: status,
        description: subscription.description,
        shortDescription: subscription.shortDescription,
        requestorRef: subscription.requestorRef ?? null,
        serviceStartDatetime: subscription.serviceStartDatetime
            ? subscription.serviceStartDatetime
            : currentTimestamp ?? null,
        operatorRefs: subscription.operatorRefs ?? null,
        publisherId: subscription.publisherId ?? null,
        lastModifiedDateTime: currentTimestamp ?? null,
        apiKey: subscription.apiKey,
        heartbeatLastReceivedDateTime: subscription.heartbeatLastReceivedDateTime ?? null,
        lastCancellationsDataReceivedDateTime: subscription.lastCancellationsDataReceivedDateTime ?? null,
        lastResubscriptionTime: subscription.lastResubscriptionTime ?? null,
    };

    logger.info("Updating DynamoDB with subscription information");

    await putDynamoItem(tableName, subscriptionId, "SUBSCRIPTION", subscriptionTableItems);
};

export const sendSubscriptionRequestAndUpdateDynamo = async (
    subscriptionId: string,
    subscriptionDetails: Omit<CancellationsSubscription, "PK" | "status">,
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

    const operatorRefs = subscriptionDetails.operatorRefs ?? [null];

    let failedSubscriptions = false;

    for (const operatorRef of operatorRefs) {
        const messageIdentifier = randomUUID();

        try {
            const subscriptionRequestMessage = generateCancellationsSubscriptionRequestXml(
                subscriptionId,
                currentTime,
                initialTerminationTime,
                messageIdentifier,
                dataEndpoint,
                subscriptionDetails.requestorRef ?? null,
                subscriptionDetails.apiKey,
                operatorRef ?? null,
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
                logger.error(
                    `No response body received from the data producer: ${subscriptionDetails.url}, operatorRef: ${operatorRef}`,
                );
                failedSubscriptions = true;

                continue;
            }

            const parsedResponseBody = parseXml(subscriptionResponseBody, subscriptionId);

            // Stagecoach don't return a Status when passing a distinct SubscriptionIdentifier for an operator
            // so we don't do this check if isInternal is true
            if (!isInternal && parsedResponseBody.Siri.SubscriptionResponse.ResponseStatus.Status !== "true") {
                logger.error(
                    `The data producer: ${subscriptionDetails.url} did not return a status of true, operatorRef: ${operatorRef}`,
                );
                failedSubscriptions = true;
            }
        } catch (error) {
            logger.error(`Error subscribing to feed: ${subscriptionDetails.url}, operatorRef: ${operatorRef}`);
            logger.error(error);
            failedSubscriptions = true;
        }
    }

    if (failedSubscriptions) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "error");
        throw new Error(
            `Error subscribing to cancellations feed: ${subscriptionDetails.url}, operatorRefs: ${operatorRefs.join(
                ", ",
            )}`,
        );
    }

    await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, subscriptionDetails, "live", currentTime);
};
