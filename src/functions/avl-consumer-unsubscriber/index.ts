import {
    createHttpNoContentResponse,
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpServiceUnavailableErrorResponse,
    createHttpValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import { getAvlConsumerSubscription } from "@bods-integrated-data/shared/avl-consumer/utils";
import { deleteAlarm, putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import { deleteSchedule } from "@bods-integrated-data/shared/eventBridge";
import { deleteEventSourceMapping } from "@bods-integrated-data/shared/lambda";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlConsumerSubscription, terminateSubscriptionRequestSchema } from "@bods-integrated-data/shared/schema";
import { deleteQueue } from "@bods-integrated-data/shared/sqs";
import { SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/utils";
import { InvalidXmlError, createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestHeadersSchema = z.object({
    "x-api-key": createStringLengthValidation("x-api-key header"),
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
        const { AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME } = process.env;

        if (!AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME) {
            throw new Error("Missing env vars - AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME must be set");
        }

        const headers = requestHeadersSchema.parse(event.headers);
        const apiKey = headers["x-api-key"];
        const body = requestBodySchema.parse(event.body);
        const xml = parseXml(body);
        const subscriptionId = xml.Siri.TerminateSubscriptionRequest.SubscriptionRef;
        logger.subscriptionId = subscriptionId;

        const subscription = await getAvlConsumerSubscription(
            AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
            apiKey,
            subscriptionId,
        );

        const updatedSubscription: AvlConsumerSubscription = {
            ...subscription,
            status: "inactive",
        };

        if (subscription.scheduleName) {
            try {
                await deleteSchedule({
                    Name: subscription.scheduleName,
                });

                updatedSubscription.scheduleName = undefined;
            } catch (error) {
                logger.error(error, `Error deleting schedule with name: ${subscription.scheduleName}`);
                updatedSubscription.status = "error";
            }
        }

        if (subscription.queueAlarmName) {
            try {
                await deleteAlarm(subscription.queueAlarmName);

                updatedSubscription.queueAlarmName = undefined;
            } catch (error) {
                logger.error(error, `Error deleting alarm with name: ${subscription.queueAlarmName}`);
                updatedSubscription.status = "error";
            }
        }

        if (subscription.eventSourceMappingUuid) {
            try {
                await deleteEventSourceMapping({
                    UUID: subscription.eventSourceMappingUuid,
                });

                updatedSubscription.eventSourceMappingUuid = undefined;
            } catch (error) {
                logger.error(
                    error,
                    `Error deleting event source mapping with UUID: ${subscription.eventSourceMappingUuid}`,
                );
                updatedSubscription.status = "error";
            }
        }

        if (subscription.queueUrl) {
            try {
                await deleteQueue({
                    QueueUrl: subscription.queueUrl,
                });

                updatedSubscription.queueUrl = undefined;
            } catch (error) {
                logger.error(error, `Error deleting queue with URL: ${subscription.queueUrl}`);
                updatedSubscription.status = "error";
            }
        }

        await putDynamoItem(
            AVL_CONSUMER_SUBSCRIPTION_TABLE_NAME,
            subscription.PK,
            subscription.SK,
            updatedSubscription,
        );

        if (updatedSubscription.status === "error") {
            await putMetricData("custom/AvlConsumerMetrics", [
                {
                    MetricName: "FailedUnsubscribe",
                    Value: 1,
                },
            ]);

            return createHttpServiceUnavailableErrorResponse(
                "Unable to fully unsubscribe subscription, try again later",
                60,
            );
        }

        return createHttpNoContentResponse();
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, "Invalid SIRI-VM XML provided");
            return createHttpValidationErrorResponse(["Invalid SIRI-VM XML provided"]);
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            return createHttpNotFoundErrorResponse("Subscription not found");
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl-consumer-unsubscriber endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
