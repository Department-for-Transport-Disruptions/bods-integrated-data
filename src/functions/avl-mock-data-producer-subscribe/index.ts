import { randomUUID } from "node:crypto";
import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import {
    SubscriptionRequest,
    subscriptionRequestSchema,
    subscriptionResponseSchema,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayEvent } from "aws-lambda";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = subscriptionRequestSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the subscription request.", parsedJson.error.format());

        throw new Error("Error parsing subscription request");
    }

    return parsedJson.data;
};

export const generateSubscriptionResponse = (subscriptionRequest: SubscriptionRequest) => {
    const currentTimestamp = getDate().toISOString();
    const requestMessageRef = randomUUID();

    const subscriptionResponseJson = {
        SubscriptionResponse: {
            ResponseTimestamp: currentTimestamp,
            ResponderRef: "Mock AVL Producer",
            RequestMessageRef: requestMessageRef,
            ResponseStatus: {
                ResponseTimestamp: currentTimestamp,
                RequestMessageRef: subscriptionRequest.SubscriptionRequest.RequestorRef,
                SubscriberRef: "Mock subscriber",
                SubscriptionRef:
                    subscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier,
                Status: "ACTIVE",
            },
            ServiceStartedTime: currentTimestamp,
        },
    };

    const verifiedSubscriptionResponse = subscriptionResponseSchema.parse(subscriptionResponseJson);

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
            ...verifiedSubscriptionResponse,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    const response = builder.build(completeObject) as string;

    return response;
};

export const handler = (event: APIGatewayEvent) => {
    return new Promise((resolve) => {
        logger.info("Handling subscription request");

        const parsedBody = parseXml(event.body ?? "");

        logger.info("Successfully parsed xml");

        const subscriptionResponse = generateSubscriptionResponse(parsedBody);

        logger.info("Returning subscription response");
        resolve({
            statusCode: 200,
            ok: true,
            body: subscriptionResponse,
        });
    });
};
