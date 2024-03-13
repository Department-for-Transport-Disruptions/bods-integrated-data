import { z } from "zod";

export const operatorSchema = z.object({
    NationalOperatorCode: z.string(),
    OperatorShortName: z.string(),
});

export const stopSchema = z.object({
    StopPointRef: z.coerce.string(),
    CommonName: z.string(),
    Location: z.optional(
        z.object({
            Longitude: z.number(),
            Latitude: z.number(),
        }),
    ),
});

export type Operator = z.infer<typeof operatorSchema>;

export type Stop = z.infer<typeof stopSchema>;

export const txcSchema = z.object({
    TransXChange: z.object({
        Operators: z.object({
            Operator: z.array(operatorSchema),
        }),
        StopPoints: z.object({
            AnnotatedStopPointRef: z.array(stopSchema),
        }),
    }),
});
