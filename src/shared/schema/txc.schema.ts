import { z } from "zod";

export const operatorSchema = z
    .object({
        NationalOperatorCode: z.coerce.string().optional(),
        OperatorCode: z.coerce.string().optional(),
        OperatorShortName: z.string(),
    })
    .refine((op) => op.NationalOperatorCode || op.OperatorCode)
    .transform((op) => ({
        ...op,
        NationalOperatorCode: op.NationalOperatorCode || op.OperatorCode,
    }));

export type Operator = z.infer<typeof operatorSchema>;

export const txcSchema = z.object({
    TransXChange: z.object({
        Operators: z.object({
            Operator: z.array(operatorSchema),
        }),
    }),
});
