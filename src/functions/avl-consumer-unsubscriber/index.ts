import {
    createNoContentResponse,
    createNotFoundErrorResponse,
    createServerErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { getAvlConsumerSubscription } from "@bods-integrated-data/shared/avl-consumer/utils";
import { SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/avl/utils";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { deleteSchedule } from "@bods-integrated-data/shared/eventBridge";
import { deleteEventSourceMapping } from "@bods-integrated-data/shared/lambda";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription, terminateSubscriptionRequestSchema } from "@bods-integrated-data/shared/schema";
import { deleteQueue } from "@bods-integrated-data/shared/sqs";
import { InvalidXmlError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

const requestHeadersSchema = z.object({
    userId: createStringLengthValidation("userId header"),
});

const requestBodySchema = z.string({
    required_error: "Body is required",
    invalid_type_error: "Body must be a string",
});

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
    });

    const parsedXml = parser.parse(xml);
    const parsedJson = terminateSubscriptionRequestSchema.safeParse(parsedXml);

    if (!parsedJson.success) {
        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME: avlConsumerSubscriptionTableName } = process.env;

        if (!avlConsumerSubscriptionTableName) {
            throw new Error("Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set");
        }

        const { userId } = requestHeadersSchema.parse(event.headers);
        const body = requestBodySchema.parse(event.body);
        const xml = parseXml(body);
        const subscriptionId = xml.Siri.TerminateSubscriptionRequest.SubscriptionRef;

        const subscription = await getAvlConsumerSubscription(avlConsumerSubscriptionTableName, subscriptionId, userId);

        const updatedSubscription: AvlConsumerSubscription = {
            ...subscription,
            status: "inactive",
        };

        if (subscription.scheduleName) {
            try {
                await deleteSchedule({
                    Name: subscription.scheduleName,
                });

                updatedSubscription.scheduleName = "";
            } catch (error) {
                logger.error(error, `Error deleting schedule with name: ${subscription.scheduleName}`);
            }
        }

        if (subscription.eventSourceMappingUuid) {
            try {
                await deleteEventSourceMapping({
                    UUID: subscription.eventSourceMappingUuid,
                });

                updatedSubscription.eventSourceMappingUuid = "";
            } catch (error) {
                logger.error(
                    error,
                    `Error deleting event source mapping with UUID: ${subscription.eventSourceMappingUuid}`,
                );
            }
        }

        if (subscription.queueUrl) {
            try {
                await deleteQueue({
                    QueueUrl: subscription.queueUrl,
                });

                updatedSubscription.queueUrl = "";
            } catch (error) {
                logger.error(error, `Error deleting queue with URL: ${subscription.queueUrl}`);
            }
        }

        await putDynamoItem(avlConsumerSubscriptionTableName, subscription.PK, subscription.SK, updatedSubscription);

        return createNoContentResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, "Invalid SIRI-VM XML provided");
            return createValidationErrorResponse(["Invalid SIRI-VM XML provided"]);
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            return createNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl-consumer-unsubscriber endpoint");
        }

        return createServerErrorResponse();
    }
};
