import { randomUUID } from "node:crypto";
import { CompleteSiriObject } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import {
    AvlSubscriptionRequest,
    AvlSubscriptionResponse,
    avlSubscriptionRequestSchema,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
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

    const subscriptionResponseJson: AvlSubscriptionResponse = {
        SubscriptionResponse: {
            ResponseTimestamp: currentTime,
            ResponderRef: "Mock AVL Producer",
            RequestMessageRef: requestMessageRef,
            ResponseStatus: {
                ResponseTimestamp: currentTime,
                SubscriberRef: "Mock subscriber",
                SubscriptionRef:
                    subscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier,
                Status: "true",
            },
            ServiceStartedTime: currentTime,
        },
    };

    const completeObject: CompleteSiriObject<AvlSubscriptionResponse> = {
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
            ...subscriptionResponseJson,
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

    const parsedBody = parseXml(event.body ?? "");

    logger.info("Successfully parsed xml");

    const subscriptionResponse = generateSubscriptionResponse(parsedBody);

    logger.info("Returning subscription response");

    return {
        statusCode: 200,
        body: subscriptionResponse,
    };
};
