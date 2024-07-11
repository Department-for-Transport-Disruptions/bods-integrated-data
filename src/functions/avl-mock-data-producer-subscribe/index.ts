import { randomUUID } from "node:crypto";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import {
    AvlSubscriptionRequest,
    avlSubscriptionRequestSchema,
    avlSubscriptionResponseSchema,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = avlSubscriptionRequestSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the subscription request.", parsedJson.error.format());

        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

export const generateSubscriptionResponse = (subscriptionRequest: AvlSubscriptionRequest) => {
    const currentTime = getDate().toISOString();
    const requestMessageRef = randomUUID();

    const subscriptionResponseJson = {
        SubscriptionResponse: {
            ResponseTimestamp: currentTime,
            ResponderRef: "Mock AVL Producer",
            RequestMessageRef: requestMessageRef,
            ResponseStatus: {
                ResponseTimestamp: currentTime,
                RequestMessageRef: subscriptionRequest.SubscriptionRequest.RequestorRef,
                SubscriberRef: "Mock subscriber",
                SubscriptionRef:
                    subscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier,
                Status: "LIVE",
            },
            ServiceStartedTime: currentTime,
        },
    };

    const verifiedSubscriptionResponse = avlSubscriptionResponseSchema.parse(subscriptionResponseJson);

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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    logger.info("Handling subscription request");

    const parsedBody = parseXml(event.body ?? "");

    logger.info("Successfully parsed xml");

    const subscriptionResponse = generateSubscriptionResponse(parsedBody);

    logger.info("Returning subscription response");

    return {
        statusCode: 200,
        body: subscriptionResponse,
    };
};
