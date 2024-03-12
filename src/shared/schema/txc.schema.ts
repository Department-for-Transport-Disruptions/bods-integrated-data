import { z } from "zod";

export const operatorSchema = z.object({
    NationalOperatorCode: z.string(),
    OperatorShortName: z.string(),
    "@_id": z.string(),
});

export type Operator = z.infer<typeof operatorSchema>;

export const txcSchema = z.object({
    TransXChange: z.object({
        Operators: z.object({
            Operator: z.array(operatorSchema),
        }),
    }),
});
