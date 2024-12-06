import { randomUUID } from "node:crypto";
import dayjs from "dayjs";
import { z } from "zod";
import { getCancellationErrorDetails } from "../../cancellations/utils";
import { putMetricData } from "../../cloudwatch";
import { logger } from "../../logger";
import { CancellationsValidationError } from "../cancellations-validation-error.schema";
import { datetimeSchema } from "../misc.schema";
import { enumSchema } from "../utils";
import {
    ArrivalBoardingActivity,
    CallStatus,
    Condition,
    DayType,
    DepartureBoardingActivity,
    EnvironmentReason,
    EquipmentReason,
    FacilityStatus,
    InterchangeStatus,
    MiscellaneousReason,
    PersonnelReason,
    Progress,
    RoutePointType,
    Severity,
    SourceType,
    StopPointType,
    VehicleMode,
} from "./enums";

export const booleanStringSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const iso8601DurationSchema = z.string().regex(/^PT([0-9]+\.)?[0-9]+[HMS]$/);

export const sourceTypeSchema = enumSchema(SourceType);

export const progressSchema = enumSchema(Progress);

export const miscellaneousReasonSchema = enumSchema(MiscellaneousReason);

export const personnelReasonSchema = enumSchema(PersonnelReason);

export const equipmentReasonSchema = enumSchema(EquipmentReason);

export const environmentReasonSchema = enumSchema(EnvironmentReason);

export const dayTypeSchema = enumSchema(DayType);

export const sourceSchema = z.object({
    SourceType: sourceTypeSchema,
    TimeOfCommunication: datetimeSchema.optional(),
});

export const periodSchema = z
    .object({
        StartTime: datetimeSchema,
        EndTime: datetimeSchema.optional(),
    })
    .refine(
        (obj) => (obj.EndTime ? dayjs(obj.EndTime).isAfter(dayjs(obj.StartTime)) : true),
        "End Time must be after Start Time",
    );

export const infoLinkSchema = z.object({
    Uri: z.string().url(),
});

export const situationElementRefSchema = z.object({
    CreationTime: datetimeSchema.optional(),
    VersionedAtTime: datetimeSchema.optional(),
    ParticipantRef: z.string(),
    SituationNumber: z.string(),
});

export const referenceSchema = z.object({
    RelatedToRef: z.array(situationElementRefSchema),
});

export const repetitionsSchema = z.object({
    DayType: z.array(dayTypeSchema),
});

export const infoLinksSchema = z.object({
    InfoLink: z.array(infoLinkSchema),
});

export const affectedOperatorSchema = z.object({
    OperatorRef: z.string(),
    OperatorName: z.string().optional(),
});

export const operatorsSchema = z.object({
    AllOperators: z.literal("").optional(),
    AffectedOperator: z.array(affectedOperatorSchema).optional(),
});

export const affectedLineSchema = z.object({
    AffectedOperator: affectedOperatorSchema.optional(),
    LineRef: z.string(),
    PublishedLineName: z.string(),
    Direction: z
        .object({
            DirectionRef: z.union([z.literal("inboundTowardsTown"), z.literal("outboundFromTown")]),
        })
        .optional(),
});

export const networksSchema = z.object({
    AffectedNetwork: z.array(
        z.object({
            NetworkRef: z.string().optional(),
            NetworkName: z.string().optional(),
            VehicleMode: enumSchema(VehicleMode),
            AllLines: z.literal("").optional(),
            AffectedLine: z.array(affectedLineSchema).optional(),
        }),
    ),
});

export const placesSchema = z.object({
    AffectedPlace: z.array(
        z.object({
            PlaceRef: z.string(),
            PlaceName: z.string(),
            PlaceCategory: z.string(),
        }),
    ),
});

export const affectedStopPointSchema = z.object({
    StopPointRef: z.string().optional(),
    StopPointName: z.string().optional(),
    StopPointType: enumSchema(StopPointType).optional(),
    Location: z
        .object({
            Longitude: z.coerce.number(),
            Latitude: z.coerce.number(),
        })
        .optional(),
    AffectedModes: z
        .object({
            Mode: z.object({
                VehicleMode: enumSchema(VehicleMode),
            }),
        })
        .optional(),
});

export const affectedStopPointsSchema = z.object({
    AffectedStopPoint: z.array(affectedStopPointSchema),
});

export const callsSchema = z.object({
    Call: z.array(
        affectedStopPointSchema.and(
            z.object({
                Order: z.coerce.number().optional(),
                CallCondition: enumSchema(RoutePointType).optional(),
                VehicleAtStop: booleanStringSchema.optional(),
                VehicleLocationAtStop: z
                    .object({
                        Longitude: z.coerce.number(),
                        Latitude: z.coerce.number(),
                    })
                    .optional(),
                TimingPoint: booleanStringSchema.optional(),
                BoardingStretch: booleanStringSchema.optional(),
                RequestStop: booleanStringSchema.optional(),
                OriginDisplay: z.string().optional(),
                DestinationDisplay: z.string().optional(),
                AimedArrivalTime: datetimeSchema.optional(),
                ActualArrivalTime: datetimeSchema.optional(),
                ExpectedArrivalTime: datetimeSchema.optional(),
                ArrivalStatus: enumSchema(CallStatus).optional(),
                ArrivalPlatformName: z.string().optional(),
                ArrivalBoardingActivity: enumSchema(ArrivalBoardingActivity).optional(),
                AimedDepartureTime: datetimeSchema.optional(),
                ActualDepartureTime: datetimeSchema.optional(),
                ExpectedDepartureTime: datetimeSchema.optional(),
                DepartureStatus: enumSchema(CallStatus).optional(),
                DeparturePlatformName: z.string().optional(),
                DepartureBoardingActivity: enumSchema(DepartureBoardingActivity).optional(),
                AimedHeadwayInterval: iso8601DurationSchema.optional(),
                ExpectedHeadwayInterval: iso8601DurationSchema.optional(),
                AffectedInterchange: z
                    .object({
                        InterchangeRef: z.string().optional(),
                        InterchangeStopPointRef: z.string().optional(),
                        InterchangeStopPointName: z.string().optional(),
                        ConnectingVehicleJourneyRef: z.string().optional(),
                        InterchangeStatusType: enumSchema(InterchangeStatus).optional(),
                        ConnectionLink: z.string().optional(),
                    })
                    .optional(),
            }),
        ),
    ),
});

export const facilitiesSchema = z.object({
    Facility: z.array(
        z.object({
            FacilityRef: z.string().optional(),
            StartStopPointRef: z.string().optional(),
            EndStopPointRef: z.string().optional(),
            FacilityName: z.string().optional(),
            FacilityStatus: enumSchema(FacilityStatus).optional(),
        }),
    ),
});

export const journeyPartsSchema = z.object({
    JourneyPartInfo: z.array(
        z.object({
            JourneyPartRef: z.string(),
            TrainNumberRef: z.string().optional(),
            OperatorRef: z.string().optional(),
        }),
    ),
});

export const affectedRouteSchema = z.object({
    RouteRef: z.string().optional(),
    Direction: z
        .object({
            DirectionRef: z.string(),
            DirectionName: z.string().array().optional(),
        })
        .optional(),
    Sections: z
        .object({
            AffectedSection: z
                .object({
                    SectionRef: z.string().optional(),
                    Offset: z
                        .object({
                            DistanceFromStart: z.coerce.number().optional(),
                            DistanceFromEnd: z.coerce.number().optional(),
                        })
                        .optional(),
                })
                .array(),
        })
        .optional(),
    StopPoints: z
        .object({
            AffectedOnly: booleanStringSchema.optional(),
            AffectedStopPoint: z.array(affectedStopPointSchema),
        })
        .optional(),
    RouteLinks: z
        .object({
            RouteLinkRef: z.string().array(),
        })
        .optional(),
});

export const journeysSchema = z.object({
    AffectedVehicleJourney: z.array(
        z.object({
            VehicleJourneyRef: z.string(),
            DatedVehicleJourneyRef: z.string().optional(),
            JourneyName: z.string().optional(),
            Operator: affectedOperatorSchema.optional(),
            LineRef: z.string().optional(),
            PublishedLineName: z.string().optional(),
            DirectionRef: z.string().optional(),
            BlockRef: z.string().optional(),
            JourneyParts: journeyPartsSchema.optional(),
            Origins: z.array(affectedStopPointSchema).optional(),
            Destinations: z.array(affectedStopPointSchema).optional(),
            Route: affectedRouteSchema.or(
                z
                    .literal("")
                    .optional()
                    .transform(() => ({})),
            ),
            OriginAimedDepartureTime: datetimeSchema.optional(),
            DestinationAimedArrivalTime: datetimeSchema.optional(),
            OriginDisplayAtDestination: z.string().optional(),
            DestinationDisplayAtOrigin: z.string().optional(),
            JourneyCondition: enumSchema(Condition).optional(),
            Calls: callsSchema.optional(),
            Facilities: facilitiesSchema.optional(),
        }),
    ),
});

export const affectsSchema = z.object({
    Operators: operatorsSchema.optional(),
    Networks: networksSchema.optional(),
    Places: placesSchema.optional(),
    StopPoints: affectedStopPointsSchema.optional(),
    VehicleJourneys: journeysSchema.optional(),
});

export const consequenceSchema = z.object({
    Condition: enumSchema(Condition).optional(),
    Severity: enumSchema(Severity).default(Severity.unknown),
    Affects: affectsSchema.optional(),
    Advice: z
        .object({
            Details: z.string(),
        })
        .optional(),
    Blocking: z
        .object({
            JourneyPlanner: booleanStringSchema,
        })
        .optional(),
    Delays: z
        .object({
            Delay: iso8601DurationSchema,
        })
        .optional(),
});

export const consequencesSchema = z.object({
    Consequence: z.array(consequenceSchema),
});

/**
 * The use of multiple "and" clauses here is used to preserve the specific order
 * of properties, in case the schema is ever used to generate siri-sx XML.
 */
export const ptSituationElementSchema = z
    .object({
        CreationTime: situationElementRefSchema.shape.CreationTime,
        ParticipantRef: situationElementRefSchema.shape.ParticipantRef,
        SituationNumber: situationElementRefSchema.shape.SituationNumber,
        Version: z.coerce.number().optional(),
        Source: sourceSchema,
        VersionedAtTime: situationElementRefSchema.shape.VersionedAtTime,
        References: referenceSchema.optional(),
        Progress: progressSchema,
        ValidityPeriod: z.array(periodSchema),
        Repetitions: repetitionsSchema.optional(),
        PublicationWindow: periodSchema.optional(),
    })
    .and(
        z.union([
            z.object({ MiscellaneousReason: miscellaneousReasonSchema }),
            z.object({ PersonnelReason: personnelReasonSchema }),
            z.object({ EquipmentReason: equipmentReasonSchema }),
            z.object({ EnvironmentReason: environmentReasonSchema }),
        ]),
    )
    .and(
        z.object({
            Planned: booleanStringSchema.optional(),
            Summary: z.string().optional(),
            Description: z.string().optional(),
            InfoLinks: infoLinksSchema.optional(),
            Affects: affectsSchema.optional(),
            Consequences: consequencesSchema.optional(),
        }),
    );

/**
 * The purpose of this transformer is to filter out invalid situations
 * and return the rest of the data as valid.
 */
const makeFilteredPtSituationArraySchema = (namespace: string, errors?: CancellationsValidationError[]) =>
    z.preprocess((input) => {
        const result = z.any().array().parse(input);

        return result.filter((item) => {
            const parsedItem = ptSituationElementSchema.safeParse(item);

            if (!parsedItem.success) {
                logger.warn("Error parsing item");
                logger.warn(parsedItem.error.format());

                errors?.push(
                    ...parsedItem.error.errors.map<CancellationsValidationError>((error) => {
                        const { name, message } = getCancellationErrorDetails(error);

                        return {
                            PK: "",
                            SK: randomUUID(),
                            timeToExist: 0,
                            details: message,
                            filename: "",
                            name,
                            situationNumber: item?.SituationNumber,
                            version: item?.Version,
                        };
                    }),
                );

                putMetricData(`custom/${namespace}`, [
                    { MetricName: "MakeFilteredPtSituationArrayParseError", Value: 1 },
                ]);
            }

            return parsedItem.success;
        });
    }, z.array(ptSituationElementSchema));

export const siriSxSchema = (errors?: CancellationsValidationError[]) =>
    z.object({
        Siri: z.object({
            ServiceDelivery: z.object({
                ResponseTimestamp: datetimeSchema,
                ProducerRef: z.string().optional(),
                ResponseMessageIdentifier: z.string().optional(),
                SituationExchangeDelivery: z.object({
                    ResponseTimestamp: datetimeSchema,
                    Status: booleanStringSchema.optional(),
                    ShortestPossibleCycle: z.string().optional(),
                    Situations: z.object({
                        PtSituationElement: makeFilteredPtSituationArraySchema("SiriSxPtSituationArraySchema", errors),
                    }),
                }),
            }),
        }),
    });
