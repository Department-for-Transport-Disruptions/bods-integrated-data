import { z } from "zod";

export const nocTableRecordSchema = z.object({
    NOCCODE: z.string(),
    OperatorPublicName: z.string(),
    VOSA_PSVLicenseName: z.string(),
    OpId: z.coerce.string(),
    PubNmId: z.coerce.string(),
    NOCCdQual: z.string().optional(),
    ChangeDate: z.string().optional(),
    ChangeAgent: z.string().optional(),
    ChangeCommentent: z.string().optional(),
    DateCeased: z.string().optional(),
    DataOwner: z.string().optional(),
});

export type NocTableRecord = z.infer<typeof nocTableRecordSchema>;

export const nocSchema = z.object({
    travelinedata: z.object({
        NOCTable: z.object({
            NOCTableRecord: nocTableRecordSchema.array(),
        }),
    }),
});
