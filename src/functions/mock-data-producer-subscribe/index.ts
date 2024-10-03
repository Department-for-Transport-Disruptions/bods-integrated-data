import { randomUUID } from "node:crypto";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import {
    AvlSubscriptionRequest,
    AvlSubscriptionResponse,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import {
    CancellationsSubscriptionRequest,
    CancellationsSubscriptionResponse,
} from "@bods-integrated-data/shared/schema/cancellations-subscribe.schema";
import { CompleteSiriObject } from "@bods-integrated-data/shared/utils";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
    });

    return parser.parse(xml);
};

export const generateAvlSubscriptionResponse = (subscriptionRequest: AvlSubscriptionRequest) => {
    const currentTime = getDate().toISOString();
    const requestMessageRef = randomUUID();

    const subscriptionResponseJson: AvlSubscriptionResponse = {
        Siri: {
            SubscriptionResponse: {
                ResponseTimestamp: currentTime,
                ResponderRef: "Mock AVL Producer",
                RequestMessageRef: requestMessageRef,
                ResponseStatus: {
                    ResponseTimestamp: currentTime,
                    SubscriberRef: "Mock subscriber",
                    SubscriptionRef:
                        subscriptionRequest.Siri.SubscriptionRequest.VehicleMonitoringSubscriptionRequest
                            .SubscriptionIdentifier,
                    Status: "true",
                },
                ServiceStartedTime: currentTime,
            },
        },
    };

    const completeObject: CompleteSiriObject<AvlSubscriptionResponse["Siri"]> = {
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
            ...subscriptionResponseJson.Siri,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    const response = builder.build(completeObject) as string;

    return response;
};

export const generateCancellationsSubscriptionResponse = (subscriptionRequest: CancellationsSubscriptionRequest) => {
    const currentTime = getDate().toISOString();
    const requestMessageRef = randomUUID();

    const subscriptionResponseJson: AvlSubscriptionResponse = {
        Siri: {
            SubscriptionResponse: {
                ResponseTimestamp: currentTime,
                ResponderRef: "Mock AVL Producer",
                RequestMessageRef: requestMessageRef,
                ResponseStatus: {
                    ResponseTimestamp: currentTime,
                    SubscriberRef: "Mock subscriber",
                    SubscriptionRef:
                        subscriptionRequest.Siri.SubscriptionRequest.SituationExchangeSubscriptionRequest
                            .SubscriptionIdentifier,
                    Status: "true",
                },
                ServiceStartedTime: currentTime,
            },
        },
    };

    const completeObject: CompleteSiriObject<CancellationsSubscriptionResponse["Siri"]> = {
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
            ...subscriptionResponseJson.Siri,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    const response = builder.build(completeObject) as string;

    return response;
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    logger.info("Handling subscription request");

    const xml = parseXml(event.body ?? "");

    if (!xml.Siri) {
        throw new InvalidXmlError();
    }

    logger.info("Successfully parsed xml");

    let subscriptionResponse = "";

    if (xml?.Siri?.SubscriptionRequest?.VehicleMonitoringSubscriptionRequest) {
        subscriptionResponse = generateAvlSubscriptionResponse(xml);
    }

    if (xml?.Siri?.SubscriptionRequest?.SituationExchangeSubscriptionRequest) {
        subscriptionResponse = generateCancellationsSubscriptionResponse(xml);
    }

    logger.info("Returning subscription response");

    return {
        statusCode: 200,
        body: subscriptionResponse,
    };
};
