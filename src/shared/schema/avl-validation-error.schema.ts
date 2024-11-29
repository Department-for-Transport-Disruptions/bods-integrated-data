import { z } from "zod";
import { avlValidationErrorLevels } from "../constants";

export const avlValidationErrorSchema = z.object({
    PK: z.string(),
    SK: z.string(),
    details: z.string(),
    filename: z.string(),
    itemIdentifier: z.string().nullish(),
    level: z.enum(avlValidationErrorLevels),
    lineRef: z.string().nullish(),
    name: z.string(),
    operatorRef: z.string().nullish(),
    recordedAtTime: z.string().nullish(),
    responseTimestamp: z.string().nullish(),
    timeToExist: z.number(),
    vehicleJourneyRef: z.string().nullish(),
    vehicleRef: z.string().nullish(),
});

export type AvlValidationError = z.infer<typeof avlValidationErrorSchema>;

const avlValidationReportSummarySchema = z.object({
    total_error_count: z.number(),
    critical_error_count: z.number(),
    non_critical_error_count: z.number(),
    critical_score: z.number(),
    non_critical_score: z.number(),
    vehicle_activity_count: z.number(),
});

export type AvlValidationReportSummary = z.infer<typeof avlValidationReportSummarySchema>;

const errorItemSchema = z.object({
    level: z.enum(avlValidationErrorLevels),
    details: z.string(),
    identifier: z.object({
        item_identifier: z.string().nullish(),
        line_ref: z.string().nullish(),
        name: z.string(),
        operator_ref: z.string().nullish(),
        recorded_at_time: z.string().nullish(),
        vehicle_journey_ref: z.string().nullish(),
        vehicle_ref: z.string().nullish(),
    }),
});

const avlValidationReportErrorSchema = z.object({
    header: z.object({
        packet_name: z.string(),
        timestamp: z.string().nullish(),
        feed_id: z.string(),
    }),
    errors: z.array(errorItemSchema),
});

export type AvlValidationReportError = z.infer<typeof avlValidationReportErrorSchema>;

export const avlValidationReportBodySchema = z.object({
    feed_id: z.string(),
    packet_count: z.number(),
    validation_summary: avlValidationReportSummarySchema,
    errors: z.array(avlValidationReportErrorSchema),
});

export type AvlValidationReportBody = z.infer<typeof avlValidationReportBodySchema>;
