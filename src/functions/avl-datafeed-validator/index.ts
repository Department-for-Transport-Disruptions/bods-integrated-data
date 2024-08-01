import { createServerErrorResponse, createValidationErrorResponse } from "@bods-integrated-data/shared/api";
import { getAvlSubscriptionErrorData } from "@bods-integrated-data/shared/avl/utils";
import { getMetricStatistics } from "@bods-integrated-data/shared/cloudwatch";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { AvlValidationError } from "@bods-integrated-data/shared/schema/avl-validation-error.schema";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ZodError, z } from "zod";

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

export const getTotalAvlsProcessed = async (subscriptionId: string, namespace: string) => {
    const now = getDate();
    const dayAgo = now.subtract(24, "hours");

    const data = await getMetricStatistics(
        namespace,
        "TotalAvlProcessed",
        ["Sum"],
        dayAgo.toDate(),
        now.toDate(),
        300,
        [{ Name: "SubscriptionId", Value: subscriptionId }],
    );

    const totalSum = data.Datapoints?.reduce((acc, datapoint) => acc + (datapoint.Sum || 0), 0);

    return totalSum ?? 0;
};

const generateValidationSummary = (errors: AvlValidationError[], totalProcessed: number) => {
    const criticalCount = errors.filter((e) => e.level === "CRITICAL").length;
    const nonCriticalCount = errors.filter((e) => e.level === "NON-CRITICAL").length;

    return {
        total_error_count: criticalCount + nonCriticalCount,
        critical_error_count: criticalCount,
        non_critical_error_count: nonCriticalCount,
        critical_score: criticalCount / totalProcessed / 10,
        non_critical_score: (nonCriticalCount / totalProcessed / 10) * 2,
        vehicle_activity_count: totalProcessed,
    };
};

const generateResults = (errors: AvlValidationError[], subscriptionId: string) => {
    const errorsFormatted = errors.map((error) => ({
        level: error.level,
        details: error.details,
        identifier: {
            item_identifier: error.itemIdentifier,
            line_ref: error.lineRef,
            name: error.name,
            operator_ref: error.operatorRef,
            recordedAtTime: error.recordedAtTime,
            vehicle_journey_ref: error.vehicleJourneyRef,
            vehicle_ref: error.vehicleRef,
        },
    }));

    return [
        {
            header: {
                packet_name: errors[0].filename,
                timeStamp: errors[0].responseTimestamp,
                feed_id: subscriptionId,
            },
            errors: errorsFormatted,
        },
    ];
};

const generateReportBody = async (errorData: AvlValidationError[], subscriptionId: string, namespace: string) => {
    const totalProcessed = await getTotalAvlsProcessed(subscriptionId, namespace);

    return {
        feed_id: subscriptionId,
        packet_count: totalProcessed,
        validation_summary: generateValidationSummary(errorData, totalProcessed),
        errors: generateResults(errorData, subscriptionId),
    };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { AVL_VALIDATION_ERROR_TABLE: tableName, CLOUDWATCH_NAMESPACE: cloudwatchNamespace } = process.env;

        if (!tableName || !cloudwatchNamespace) {
            throw new Error("Missing env vars - AVL_VALIDATION_ERROR_TABLE and CLOUDWATCH_NAMESPACE must be set");
        }

        const { sampleSize } = requestParamsSchema.parse(event.queryStringParameters);
        const { subscriptionId } = pathParamsSchema.parse(event.pathParameters);

        const errorData = await getAvlSubscriptionErrorData(tableName, subscriptionId);

        const reportBody = await generateReportBody(errorData, subscriptionId, cloudwatchNamespace);

        logger.info("Executed avl data feed validator", { tableName, subscriptionId, sampleSize });

        return {
            statusCode: 200,
            body: JSON.stringify(reportBody),
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the avl data feed validator endpoint", e);
        }

        return createServerErrorResponse();
    }
};
