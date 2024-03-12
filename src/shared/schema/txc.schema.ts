import { z } from "zod";

export const operatorSchema = z.object({
    NationalOperatorCode: z.string(),
    OperatorShortName: z.string(),
    "@_id": z.string(),
});

export type Operator = z.infer<typeof operatorSchema>;

export const serviceSchema = z.object({
    Lines: z.object({
        Line: z.array(
            z.object({
                "@_id": z.string(),
                LineName: z.string(),
            }),
        ),
    }),
    Mode: z.string(),
    RegisteredOperatorRef: z.string(),
});

export type Service = z.infer<typeof serviceSchema>;

export const txcSchema = z.object({
    TransXChange: z.object({
        Operators: z.object({
            Operator: z.array(operatorSchema),
        }),
        Services: z.object({
            Service: z.array(serviceSchema),
        }),
    }),
});
