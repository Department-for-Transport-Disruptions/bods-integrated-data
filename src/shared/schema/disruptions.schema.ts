import { z } from "zod";

const affectedLineSchema = z.object({
    AffectedOperator: z
        .object({
            OperatorRef: z.string().optional(),
        })
        .optional(),
    LineRef: z.string(),
});

const affectedStopPointSchema = z.object({
    StopPointRef: z.string().optional(),
});

const affectsSchema = z.object({
    Networks: z
        .object({
            AffectedNetwork: z
                .object({
                    AffectedLine: z.array(affectedLineSchema).optional(),
                })
                .array(),
        })
        .optional(),
    StopPoints: z
        .object({
            AffectedStopPoint: z.array(affectedStopPointSchema).optional(),
        })
        .optional(),
});

const consequenceSchema = z.object({
    Advice: z
        .object({
            Details: z.string(),
        })
        .optional(),
    Affects: affectsSchema.optional(),
    Blocking: z
        .object({
            JourneyPlanner: z.string().optional(),
        })
        .optional(),
    Condition: z.string(),
    Delays: z
        .object({
            Delay: z.string().optional(),
        })
        .optional(),
    Severity: z.string(),
});

export type Consequence = z.infer<typeof consequenceSchema>;

const ptSituationSchema = z.object({
    Description: z.string().optional(),
    ValidityPeriod: z.object({
        StartTime: z.string(),
        EndTime: z.string(),
    }),
    EnvironmentReason: z.string().optional(),
    EquipmentReason: z.string().optional(),
    PersonnelReason: z.string().optional(),
    MiscellaneousReason: z.string().optional(),
    Consequences: z.object({
        Consequence: z.array(consequenceSchema),
    }),
    InfoLinks: z
        .object({
            InfoLink: z.object({
                Uri: z.string(),
            }),
        })
        .optional(),
    Summary: z.string().optional(),
});

export type PtSituation = z.infer<typeof ptSituationSchema>;

export const situationSchema = z.object({
    Siri: z.object({
        SituationExchangeDelivery: z.object({
            Situations: z.object({
                PtSituationElement: z.array(ptSituationSchema),
            }),
        }),
    }),
});
