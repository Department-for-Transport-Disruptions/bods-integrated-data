import {
    createHttpNotFoundErrorResponse,
    createHttpServerErrorResponse,
    createHttpValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import { getAvlSubscription, getAvlSubscriptionErrorData } from "@bods-integrated-data/shared/avl/utils";
import { runLogInsightsQuery } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import {
    AvlValidationError,
    AvlValidationReportBody,
    AvlValidationReportError,
    AvlValidationReportSummary,
} from "@bods-integrated-data/shared/schema/avl-validation-error.schema";
import { SubscriptionIdNotFoundError } from "@bods-integrated-data/shared/utils";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        sampleSize: createStringLengthValidation("sampleSize").optional(),
    }),
);

const pathParamsSchema = z.preprocess(
    Object,
    z.object({
        subscriptionId: createStringLengthValidation("subscriptionId"),
    }),
);

export const getTotalAvlsProcessed = async (subscriptionId: string, avlProcessorLogGroupName: string) => {
    const now = getDate();
    const dayAgo = now.subtract(24, "hours");

    const data = await runLogInsightsQuery(
        avlProcessorLogGroupName,
        dayAgo.unix(),
        now.unix(),
        `filter msg = "AVL processed successfully" and subscriptionId = "${subscriptionId}"
        | stats count(*) as avlProcessed`,
    );

    const avlProcessedCount = Number.parseInt(
        data?.[0]?.find((result) => result.field === "avlProcessed")?.value || "0",
    );

    return avlProcessedCount;
};

const generateValidationSummary = (
    errors: AvlValidationError[],
    totalProcessed: number,
): AvlValidationReportSummary => {
    const criticalCount = errors.filter((e) => e.level === "CRITICAL").length;
    const nonCriticalCount = errors.filter((e) => e.level === "NON-CRITICAL").length;

    return {
        total_error_count: criticalCount + nonCriticalCount,
        critical_error_count: criticalCount,
        non_critical_error_count: nonCriticalCount,
        critical_score: 1 - criticalCount / totalProcessed / 10,
        non_critical_score: 1 - (nonCriticalCount / totalProcessed / 10) * 2,
        vehicle_activity_count: totalProcessed,
    };
};

const generateResults = (errors: AvlValidationError[], subscriptionId: string): AvlValidationReportError[] => {
    const errorsFormatted = errors.map((error) => ({
        level: error.level,
        details: error.details,
        identifier: {
            item_identifier: error.itemIdentifier,
            line_ref: error.lineRef,
            name: error.name,
            operator_ref: error.operatorRef,
            recorded_at_time: error.recordedAtTime,
            vehicle_journey_ref: error.vehicleJourneyRef,
            vehicle_ref: error.vehicleRef,
        },
    }));

    return [
        {
            header: {
                packet_name: errors[0].filename,
                timestamp: errors[0].responseTimestamp,
                feed_id: subscriptionId,
            },
            errors: errorsFormatted,
        },
    ];
};

const generateReportBody = async (
    errorData: AvlValidationError[],
    subscriptionId: string,
    avlProcessorLogGroupName: string,
) => {
    const totalProcessed = await getTotalAvlsProcessed(subscriptionId, avlProcessorLogGroupName);

    const reportBody: AvlValidationReportBody = {
        feed_id: subscriptionId,
        packet_count: totalProcessed,
        validation_summary: {
            total_error_count: 0,
            critical_error_count: 0,
            non_critical_error_count: 0,
            critical_score: 1.0,
            non_critical_score: 1.0,
            vehicle_activity_count: totalProcessed,
        },
        errors: [],
    };

    if (errorData.length > 0) {
        reportBody.validation_summary = generateValidationSummary(errorData, totalProcessed);
        reportBody.errors = generateResults(errorData, subscriptionId);
    }

    return reportBody;
};

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const {
            AVL_VALIDATION_ERROR_TABLE: validationErrorsTableName,
            AVL_PROCESSOR_LOG_GROUP_NAME: avlProcessorLogGroupName,
            AVL_PRODUCER_API_KEY_ARN: avlProducerApiKeyArn,
            AVL_SUBSCRIPTIONS_TABLE_NAME: subscriptionsTableName,
        } = process.env;

        if (
            !validationErrorsTableName ||
            !avlProcessorLogGroupName ||
            !avlProducerApiKeyArn ||
            !subscriptionsTableName
        ) {
            throw new Error(
                "Missing env vars - AVL_VALIDATION_ERROR_TABLE, AVL_PRODUCER_API_KEY_ARN, AVL_PROCESSOR_LOG_GROUP_NAME and AVL_SUBSCRIPTIONS_TABLE_NAME must be set",
            );
        }

        await validateApiKey(avlProducerApiKeyArn, event.headers);

        const { sampleSize } = requestParamsSchema.parse(event.queryStringParameters);
        const { subscriptionId } = pathParamsSchema.parse(event.pathParameters);
        logger.subscriptionId = subscriptionId;

        const subscription = await getAvlSubscription(subscriptionId, subscriptionsTableName);

        if (subscription.status === "inactive") {
            logger.error("Subscription is not live, validation report will not be generated...");
            return createHttpNotFoundErrorResponse("Subscription is not live");
        }

        const errorData = await getAvlSubscriptionErrorData(validationErrorsTableName, subscriptionId);

        const reportBody = await generateReportBody(errorData, subscriptionId, avlProcessorLogGroupName);

        logger.info("Executed avl data feed validator", { sampleSize });

        return {
            statusCode: 200,
            body: JSON.stringify(reportBody),
            headers: {
                "Content-Type": "application/json",
            },
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the avl data feed validator endpoint");
        }

        if (e instanceof SubscriptionIdNotFoundError) {
            logger.error(e, "Subscription not found");
            return createHttpNotFoundErrorResponse("Subscription not found");
        }

        return createHttpServerErrorResponse();
    }
};
