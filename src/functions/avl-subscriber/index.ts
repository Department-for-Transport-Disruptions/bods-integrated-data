import { logger } from "@baselime/lambda-logger";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared";
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
import { mockSubscriptionResponseBody } from "./test/mockData";

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
            RequestorRef: "BODS",
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

export const handler = async (event: APIGatewayEvent) => {
    try {
        logger.info("Starting AVL subscriber");

        const parsedBody = avlSubscribeMessageSchema.safeParse(JSON.parse(event.body ?? ""));

        if (!parsedBody.success) {
            logger.error(JSON.stringify(parsedBody.error));
            throw new Error("Invalid subscribe message from event body.");
        }

        const avlSubscribeMessage = parsedBody.data;

        const currentTimestamp = getDate().toISOString();
        // Initial termination time for a SIRI-VM subscription request is defined as 10 years after the current time
        const initialTerminationTime = addIntervalToDate(currentTimestamp, 10, "years").toISOString();

        const subscriptionId = randomUUID();
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
            throw new Error(
                `There was an error when sending the subscription request to the data producer: ${subscriptionResponse.status}`,
            );
        }

        const subscriptionResponseBody = await subscriptionResponse.text();

        if (!subscriptionResponseBody) {
            throw new Error("No response body received from the data producer.");
        }

        const parsedResponseBody = await parseXml(subscriptionResponseBody);

        if (!parsedResponseBody.SubscriptionResponse.ResponseStatus.Status) {
            throw new Error(
                `The data producer: ${avlSubscribeMessage.dataProducerEndpoint} did not return a status of true.`,
            );
        }

        logger.info(`Successfully subscribed to data producer: ${avlSubscribeMessage.dataProducerEndpoint}.`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", e);

            throw e;
        }

        throw e;
    }
};
