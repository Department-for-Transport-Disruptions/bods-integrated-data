import { logger } from "@baselime/lambda-logger";
import { getDate } from "@bods-integrated-data/shared/dates";
import { getDynamoItem, putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { deleteParameters, getParameter } from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent } from "aws-lambda";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { randomUUID } from "crypto";
import {
    Subscription,
    subscriptionSchema,
    terminateSubscriptionRequestSchema,
    terminateSubscriptionResponseSchema,
} from "./subscription.schema";
import { mockSubscriptionResponseBody } from "./test/mockData";

const getSubscriptionInfo = async (subscriptionId: string, tableName: string) => {
    const subscription = await getDynamoItem(tableName, {
        PK: subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!subscription) {
        throw new Error(`Subscription ID: ${subscriptionId} not found in DynamoDB`);
    }

    return subscriptionSchema.parse(subscription);
};

export const generateTerminationSubscriptionRequest = (
    subscriptionId: string,
    currentTimestamp: string,
    messageIdentifier: string,
    requestorRef: string | null,
) => {
    const terminateSubscriptionRequestJson = {
        TerminateSubscriptionRequest: {
            RequestTimestamp: currentTimestamp,
            RequestorRef: requestorRef ?? "BODS",
            MessageIdentifier: messageIdentifier,
            SubscriptionRef: subscriptionId,
        },
    };

    const verifiedTerminateSubscriptionRequest = terminateSubscriptionRequestSchema.parse(
        terminateSubscriptionRequestJson,
    );

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
            ...verifiedTerminateSubscriptionRequest,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    const request = builder.build(completeObject) as string;

    return request;
};

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = terminateSubscriptionResponseSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error(
            "There was an error parsing the terminate subscription response from the data producer",
            parsedJson.error.format(),
        );

        throw new Error("Error parsing the terminate subscription response from the data producer");
    }

    return parsedJson.data;
};

const getSubscriptionUsernameAndPassword = async (subscriptionId: string) => {
    const [subscriptionUsernameParam, subscriptionPasswordParam] = await Promise.all([
        getParameter(`/subscription/${subscriptionId}/username`, true),
        getParameter(`/subscription/${subscriptionId}/password`, true),
    ]);

    const subscriptionUsername = subscriptionUsernameParam.Parameter?.Value ?? null;
    const subscriptionPassword = subscriptionPasswordParam.Parameter?.Value ?? null;

    return {
        subscriptionUsername,
        subscriptionPassword,
    };
};

const sendTerminateSubscriptionRequestAndUpdateDynamo = async (subscription: Subscription, tableName: string) => {
    const currentTimestamp = getDate().toISOString();
    const messageIdentifier = randomUUID();

    const terminateSubscriptionRequestMessage = generateTerminationSubscriptionRequest(
        subscription.PK,
        currentTimestamp,
        messageIdentifier,
        subscription.requestorRef ?? null,
    );

    const { subscriptionUsername, subscriptionPassword } = await getSubscriptionUsernameAndPassword(subscription.PK);

    if (!subscriptionUsername || !subscriptionPassword) {
        logger.error(`Missing auth credentials for subscription id: ${subscription.PK}`);
        throw new Error("Missing auth credentials for subscription");
    }

    // TODO: This block of code is to mock out the data producers response when running locally, it will be removed
    //  when we create an unsubscribe endpoint for the mock data producer.
    const terminateSubscriptionResponse =
        process.env.STAGE === "local" && subscription.requestorRef === "BODS_MOCK_PRODUCER"
            ? {
                  text: () => mockSubscriptionResponseBody,
                  status: 200,
                  ok: true,
              }
            : await fetch(subscription.url, {
                  method: "POST",
                  body: terminateSubscriptionRequestMessage,
                  headers: {
                      Authorization:
                          "Basic " + Buffer.from(`${subscriptionUsername}:${subscriptionPassword}`).toString("base64"),
                  },
              });

    if (!terminateSubscriptionResponse.ok) {
        throw new Error(
            `There was an error when sending the request to unsubscribe from the data producer - subscription ID: ${subscription.PK}, status code: ${terminateSubscriptionResponse.status}`,
        );
    }

    const terminateSubscriptionResponseBody = await terminateSubscriptionResponse.text();

    if (!terminateSubscriptionResponseBody) {
        throw new Error(`No response body received from the data producer - subscription ID: ${subscription.PK}`);
    }

    const parsedResponseBody = parseXml(terminateSubscriptionResponseBody);

    if (parsedResponseBody.TerminateSubscriptionResponse.TerminationResponseStatus.Status !== "true") {
        throw new Error(`The data producer did not return a status of true - subscription ID: ${subscription.PK}`);
    }

    logger.info("Updating subscription status in DynamoDB");

    await putDynamoItem(
        tableName,
        subscription.PK,
        "SUBSCRIPTION",

        {
            ...subscription,
            status: "TERMINATED",
            serviceEndDatetime: currentTimestamp,
        },
    );
};

const deleteSubscriptionAuthCredsFromSsm = async (subscriptionId: string) => {
    logger.info("Deleting subscription auth credentials from parameter store");

    await deleteParameters([`/subscription/${subscriptionId}/username`, `/subscription/${subscriptionId}/password`]);
};

export const handler = async (event: APIGatewayEvent) => {
    try {
        const { TABLE_NAME: tableName } = process.env;

        if (!tableName) {
            throw new Error("Missing env var: TABLE_NAME must be set.");
        }

        const subscriptionId = event.pathParameters?.subscription_id;

        if (!subscriptionId) {
            throw new Error("Subscription ID must be provided in the path parameters");
        }

        logger.info(`Starting AVL unsubscriber to unsubscribe from subscription: ${subscriptionId}`);

        const subscription = await getSubscriptionInfo(subscriptionId, tableName);

        await sendTerminateSubscriptionRequestAndUpdateDynamo(subscription, tableName);

        await deleteSubscriptionAuthCredsFromSsm(subscriptionId);

        logger.info(`Successfully unsubscribed to data producer with subscription ID: ${subscriptionId}.`);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem unsubscribing from  the AVL feed.", e);

            throw e;
        }

        throw e;
    }
};
