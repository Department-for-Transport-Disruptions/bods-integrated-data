import { logger } from "@baselime/lambda-logger";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared";
import axios from "axios";
import { parse } from "js2xmlparser";
import { parseStringPromise } from "xml2js";
import { parseBooleans } from "xml2js/lib/processors";
import { randomUUID } from "crypto";
import {
    AvlSubscribeMessage,
    avlSubscribeMessageSchema,
    subscriptionRequestSchema,
    SubscriptionResponse,
    subscriptionResponseSchema,
} from "./subscriber.schema";

const currentTimestamp = getDate().toISOString();
// Initial termination time for a SIRI-VM subscription request is defined as 10 years after the current time
const initialTerminationTime = addIntervalToDate(currentTimestamp, 10, "years").toISOString();

const mockEvent: { body: string } = {
    body: JSON.stringify({
        dataProducerEndpoint: "https://google.com",
        description: "description",
        shortDescription: "shortDescription",
    }),
};

const generateSubscriptionRequestXml = (
    avlSubscribeMessage: AvlSubscribeMessage,
    subscriptionId: string,
    currentTimestamp: string,
) => {
    const subscriptionRequestJson = {
        SubscriptionRequest: {
            RequestTimeStamp: currentTimestamp,
            Address: `${avlSubscribeMessage.dataProducerEndpoint}/${subscriptionId}`,
            RequestorRef: "BODS",
            MessageIdentifier: randomUUID(),
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

export const handler = async (event: { body: string } = mockEvent) => {
    try {
        logger.info("Starting AVL subscriber");

        const parsedBody = avlSubscribeMessageSchema.safeParse(JSON.parse(event.body ?? ""));

        if (!parsedBody.success) {
            logger.error(JSON.stringify(parsedBody.error));
            return;
        }

        const avlSubscribeMessage = parsedBody.data;

        const subscriptionId = randomUUID();

        const subscriptionRequestMessage = generateSubscriptionRequestXml(
            avlSubscribeMessage,
            subscriptionId,
            currentTimestamp,
        );

        const subscriptionResponse = await fetch(`${avlSubscribeMessage.dataProducerEndpoint}/${subscriptionId}`, {
            method: "POST",
        });

        if (!subscriptionResponse.ok) {
            throw new Error(
                `There was an error when sending the subscription request to the data producer: ${subscriptionResponse.status}`,
            );
        }

        if (!subscriptionResponse.body) {
            throw new Error("No response body received from the data producer.");
        }

        const parsedResponseBody = await parseXml(JSON.parse(subscriptionResponse.body as SubscriptionResponse));

        console.log(subscriptionRequestMessage);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", e);

            throw e;
        }

        throw e;
    }
};
