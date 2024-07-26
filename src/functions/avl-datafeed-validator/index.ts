import { createServerErrorResponse, createValidationErrorResponse } from "@bods-integrated-data/shared/api";
import { getAvlSubscriptionErrorData } from "@bods-integrated-data/shared/avl/utils";
import { getMetricStatistics } from "@bods-integrated-data/shared/cloudwatch";
import { logger } from "@bods-integrated-data/shared/logger";
import { AvlValidationError } from "@bods-integrated-data/shared/schema/avl-validation-error.schema";
import { createStringLengthValidation } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ZodError, z } from "zod";
import { getErrorDetail } from "./errorDetails";

type AvlValidationErrorWithDetails = AvlValidationError & {
    details: string;
    critical: boolean;
};

type CategorisedErrors = {
    criticalErrors: AvlValidationErrorWithDetails[];
    nonCriticalErrors: AvlValidationErrorWithDetails[];
};

const criticalErrorFields = [
    "Bearing",
    "DestinationRef",
    "LineRef",
    "Monitored-VehicleJourney",
    "OperatorRef",
    "OriginRef",
    "ProducerRef",
    "RecordedAtTime",
    "ResponseTimestamp",
    "ValidUntilTime",
    "VehicleJourneyRef",
    "VehicleLocation",
    "VehicleMonitoringDelivery",
];

const nonCriticalErrorFields = ["BlockRef", "DirectionRef", "OriginName", "PublishedLineName"];

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        sample_size: createStringLengthValidation("sample_size").optional(),
    }),
);

const pathParamsSchema = z.preprocess(
    Object,
    z.object({
        feedId: createStringLengthValidation("feedId"),
    }),
);

export const getTotalAvlsProcessed = async (feedId: string, namespace: string) => {
    const dayAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const data = await getMetricStatistics(namespace, "TotalAvlProcessed", ["Sum"], dayAgo, now, 300, [
        { Name: "SubscriptionId", Value: feedId },
    ]);

    if (!data.Datapoints) {
        throw new Error("No datapoints found when getting TotalAvlProcessed metric");
    }

    const totalSum = data.Datapoints.reduce((acc, datapoint) => acc + (datapoint.Sum || 0), 0);

    return totalSum;
};

const categoriseErrors = (errors: AvlValidationError[]) =>
    errors.reduce<CategorisedErrors>(
        (categorisedErrors, error) => {
            const errorWithDetails = { ...error, details: getErrorDetail(error.name) };
            if (criticalErrorFields.includes(error.name)) {
                categorisedErrors.criticalErrors.push({ ...errorWithDetails, critical: true });
            } else if (nonCriticalErrorFields.includes(error.name)) {
                categorisedErrors.nonCriticalErrors.push({ ...errorWithDetails, critical: false });
            } else {
                logger.warn("Unknown error category: ", error);
            }

            return categorisedErrors;
        },
        { criticalErrors: [], nonCriticalErrors: [] },
    );

const generateValidationSummary = (categorisedErrors: CategorisedErrors, totalProcessed: number) => {
    const criticalCount = categorisedErrors.criticalErrors.length;
    const nonCriticalCount = categorisedErrors.nonCriticalErrors.length;

    return {
        total_error_count: criticalCount + nonCriticalCount,
        critical_error_count: criticalCount,
        non_critical_error_count: nonCriticalCount,
        critical_score: criticalCount / totalProcessed / 10,
        non_critical_score: (nonCriticalCount / totalProcessed / 10) * 2,
        vehicle_activity_count: totalProcessed,
    };
};

const generateResults = (categorisedErrors: CategorisedErrors, feedId: string) => {
    const allErrors = categorisedErrors.criticalErrors.concat(categorisedErrors.nonCriticalErrors);
    const errors = allErrors.map((error) => ({
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
                packet_name: allErrors[0].filename,
                timeStamp: allErrors[0].responseTimestamp,
                feed_id: feedId,
            },
            errors,
        },
    ];
};

const generateReportBody = async (errorData: AvlValidationError[], feedId: string, namespace: string) => {
    const categorisedErrors = categoriseErrors(errorData);
    const totalProcessed = await getTotalAvlsProcessed(feedId, namespace);

    return {
        feed_id: feedId,
        packet_count: totalProcessed,
        validation_summary: generateValidationSummary(categorisedErrors, totalProcessed),
        errors: generateResults(categorisedErrors, feedId),
    };
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { AVL_VALIDATION_ERROR_TABLE: tableName, CLOUDWATCH_NAMESPACE: cloudwatchNamespace } = process.env;

        if (!tableName || !cloudwatchNamespace) {
            throw new Error("Missing env vars - AVL_VALIDATION_ERROR_TABLE and CLOUDWATCH_NAMESPACE must be set");
        }

        const { sample_size: sampleSize } = requestParamsSchema.parse(event.queryStringParameters);
        const { feedId } = pathParamsSchema.parse(event.pathParameters);

        const errorData = await getAvlSubscriptionErrorData(tableName, feedId);

        const reportBody = await generateReportBody(errorData, feedId, cloudwatchNamespace);

        logger.info("Executed avl data feed validator", { tableName, feedId, sampleSize });

        return {
            statusCode: 200,
            body: JSON.stringify(reportBody),
        };
    } catch (e) {
        console.error(e);
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
