import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putEventBridgeTarget } from "@bods-integrated-data/shared/eventBridge";
import { APIGatewayEvent } from "aws-lambda";
import { parse } from "js2xmlparser";
import { parseStringPromise } from "xml2js";
import { parseBooleans } from "xml2js/lib/processors";
import { randomUUID } from "crypto";
import { SubscriptionRequest, subscriptionRequestSchema, subscriptionResponseSchema } from "./subscribe.schema";

const parseXml = async (xml: string) => {
    const parsedXml = (await parseStringPromise(xml, {
        explicitArray: false,
        valueProcessors: [parseBooleans],
        ignoreAttrs: true,
    })) as Record<string, object>;

    const parsedJson = subscriptionRequestSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the subscription request.", parsedJson.error.format());

        throw new Error("Error parsing subscription request");
    }

    return parsedJson.data;
};

export const generateSubscriptionResponse = async (subscriptionRequest: SubscriptionRequest) => {
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
                SubscriptionRef:
                    subscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier,
                Status: "ACTIVE",
            },
            ServiceStartedTime: currentTimestamp,
        },
    };

    const verifiedSubscriptionResponse = subscriptionResponseSchema.parse(subscriptionResponseJson);

    const completeObject = {
        "@": {
            version: "2.0",
            xmlns: "http://www.siri.org.uk/siri",
            "xmlns:ns2": "http://www.ifopt.org.uk/acsb",
            "xmlns:ns3": "http://www.ifopt.org.uk/ifopt",
            "xmlns:ns4": "http://datex2.eu/schema/2_0RC1/2_0",
        },
        "#": verifiedSubscriptionResponse,
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

export const handler = async (event: APIGatewayEvent) => {
    try {
        const { EVENT_BRIDGE_RULE_NAME: eventBridgeRuleName, EVENT_BRIDGE_TARGET_ARN: eventBridgeTargetArn } =
            process.env;

        if (!eventBridgeRuleName || !eventBridgeTargetArn) {
            throw new Error("Missing env vars: both EVENT_BRIDGE_RULE_NAME, EVENT_BRIDGE_TARGET_ARN must be set");
        }

        logger.info("Handling subscription request");

        const parsedBody = await parseXml(event.body ?? "");

        logger.info("Successfully parsed xml");

        await putEventBridgeTarget(eventBridgeRuleName, [
            {
                Id: `avl-mock-producer-send-data-${parsedBody.SubscriptionRequest.VehicleMonitoringSubscriptionRequest.SubscriptionIdentifier}`,
                Arn: eventBridgeTargetArn,
            },
        ]);

        const subscriptionResponse = await generateSubscriptionResponse(parsedBody);

        logger.info("Successfully created EventBridge target and created and generated subscription response");

        return {
            statusCode: 200,
            ok: true,
            body: subscriptionResponse,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with handling the data consumer's subscription request.", e);

            throw e;
        }

        throw e;
    }
};
