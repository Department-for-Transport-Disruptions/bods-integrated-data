import { randomUUID } from "node:crypto";
import { logger } from "@baselime/lambda-logger";
import {
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { SubscriptionIdNotFoundError, getAvlSubscription } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { deleteParameters } from "@bods-integrated-data/shared/ssm";
import { getSubscriptionUsernameAndPassword } from "@bods-integrated-data/shared/utils";
import { InvalidXmlError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";
import { terminateSubscriptionRequestSchema, terminateSubscriptionResponseSchema } from "./subscription.schema";
import { mockSubscriptionResponseBody } from "./test/mockData";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: createStringLengthValidation("subscriptionId"),
    }),
);

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

        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

const sendTerminateSubscriptionRequestAndUpdateDynamo = async (subscription: AvlSubscription, tableName: string) => {
    const currentTime = getDate().toISOString();
    const messageIdentifier = randomUUID();

    const terminateSubscriptionRequestMessage = generateTerminationSubscriptionRequest(
        subscription.PK,
        currentTime,
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
                  data: mockSubscriptionResponseBody,
                  status: 200,
              }
            : await axios.post<string>(subscription.url, terminateSubscriptionRequestMessage, {
                  headers: {
                      "Content-Type": "text/xml",
                      Authorization: `Basic ${Buffer.from(`${subscriptionUsername}:${subscriptionPassword}`).toString(
                          "base64",
                      )}`,
                  },
              });

    const terminateSubscriptionResponseBody = terminateSubscriptionResponse.data;

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
            status: "INACTIVE",
            serviceEndDatetime: currentTime,
        },
    );
};

const deleteSubscriptionAuthCredsFromSsm = async (subscriptionId: string) => {
    logger.info("Deleting subscription auth credentials from parameter store");

    await deleteParameters([`/subscription/${subscriptionId}/username`, `/subscription/${subscriptionId}/password`]);
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { TABLE_NAME: tableName } = process.env;

        if (!tableName) {
            throw new Error("Missing env var: TABLE_NAME must be set.");
        }

        const { subscriptionId } = requestParamsSchema.parse(event.pathParameters);

        logger.info(`Starting AVL unsubscriber to unsubscribe from subscription: ${subscriptionId}`);

        const subscription = await getAvlSubscription(subscriptionId, tableName);

        try {
            await sendTerminateSubscriptionRequestAndUpdateDynamo(subscription, tableName);
        } catch (e) {
            if (e instanceof AxiosError) {
                logger.error(
                    `There was an error when sending the unsubscribe request to the data producer for subscription ${subscriptionId} - code: ${e.code}, message: ${e.message}`,
                );
            }

            throw e;
        }

        await deleteSubscriptionAuthCredsFromSsm(subscriptionId);

        logger.info(`Successfully unsubscribed to data producer with subscription ID: ${subscriptionId}.`);

        return {
            statusCode: 204,
            body: "",
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidXmlError) {
            logger.warn("Invalid SIRI-VM XML provided by the data producer", e);
            return createValidationErrorResponse(["Invalid SIRI-VM XML provided by the data producer"]);
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error("Subscription not found", e);
            return createNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the AVL unsubscribe endpoint", e);
        }

        return createServerErrorResponse();
    }
};
