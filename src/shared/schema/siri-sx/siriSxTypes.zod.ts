import dayjs from "dayjs";
import { z } from "zod";
import { putMetricData } from "../../cloudwatch";
import { logger } from "../../logger";
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

export const datetimeSchema = z.string().datetime({ offset: true });

export const booleanStringSchema = z.string().transform((value) => value === "true");

export const iso8601DurationSchema = z.string().regex(/^PT([0-9]+\.)?[0-9]+[HMS]$/);

export const sourceTypeSchema = z.nativeEnum(SourceType);

export const progressSchema = z.nativeEnum(Progress);

export const miscellaneousReasonSchema = z.nativeEnum(MiscellaneousReason);

export const personnelReasonSchema = z.nativeEnum(PersonnelReason);

export const equipmentReasonSchema = z.nativeEnum(EquipmentReason);

export const environmentReasonSchema = z.nativeEnum(EnvironmentReason);

export const dayTypeSchema = z.nativeEnum(DayType);

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
            VehicleMode: z.nativeEnum(VehicleMode),
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
    StopPointType: z.nativeEnum(StopPointType).optional(),
    Location: z
        .object({
            Longitude: z.number(),
            Latitude: z.number(),
        })
        .optional(),
    AffectedModes: z
        .object({
            Mode: z.object({
                VehicleMode: z.nativeEnum(VehicleMode),
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
                Order: z.number().optional(),
                CallCondition: z.nativeEnum(RoutePointType).optional(),
                VehicleAtStop: booleanStringSchema.optional(),
                VehicleLocationAtStop: z
                    .object({
                        Longitude: z.number(),
                        Latitude: z.number(),
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
                ArrivalStatus: z.nativeEnum(CallStatus).optional(),
                ArrivalPlatformName: z.string().optional(),
                ArrivalBoardingActivity: z.nativeEnum(ArrivalBoardingActivity).optional(),
                AimedDepartureTime: datetimeSchema.optional(),
                ActualDepartureTime: datetimeSchema.optional(),
                ExpectedDepartureTime: datetimeSchema.optional(),
                DepartureStatus: z.nativeEnum(CallStatus).optional(),
                DeparturePlatformName: z.string().optional(),
                DepartureBoardingActivity: z.nativeEnum(DepartureBoardingActivity).optional(),
                AimedHeadwayInterval: iso8601DurationSchema.optional(),
                ExpectedHeadwayInterval: iso8601DurationSchema.optional(),
                AffectedInterchange: z
                    .object({
                        InterchangeRef: z.string().optional(),
                        InterchangeStopPointRef: z.string().optional(),
                        InterchangeStopPointName: z.string().optional(),
                        ConnectingVehicleJourneyRef: z.string().optional(),
                        InterchangeStatusType: z.nativeEnum(InterchangeStatus).optional(),
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
            FacilityStatus: z.nativeEnum(FacilityStatus).optional(),
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
            Route: z.string(),
            OriginAimedDepartureTime: datetimeSchema.optional(),
            DestinationAimedArrivalTime: datetimeSchema.optional(),
            OriginDisplayAtDestination: z.string().optional(),
            DestinationDisplayAtOrigin: z.string().optional(),
            JourneyCondition: z.nativeEnum(Condition).optional(),
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
    Condition: z.nativeEnum(Condition).optional(),
    Severity: z.nativeEnum(Severity),
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
        MiscellaneousReason: miscellaneousReasonSchema.optional(),
        PersonnelReason: personnelReasonSchema.optional(),
        EquipmentReason: equipmentReasonSchema.optional(),
        EnvironmentReason: environmentReasonSchema.optional(),
        Planned: booleanStringSchema.optional(),
        Summary: z.string().optional(),
        Description: z.string().optional(),
        InfoLinks: infoLinksSchema.optional(),
        Affects: affectsSchema.optional(),
        Consequences: consequencesSchema.optional(),
    })
    .refine(
        (situation) =>
            situation.MiscellaneousReason ||
            situation.PersonnelReason ||
            situation.EquipmentReason ||
            situation.EnvironmentReason,
    );

/**
 * The purpose of this transformer is to filter out invalid situations
 * and return the rest of the data as valid.
 */
const makeFilteredPtSituationArraySchema = (namespace: string) =>
    z.preprocess((input) => {
        const result = z.any().array().parse(input);

        return result.filter((item) => {
            const parsedItem = ptSituationElementSchema.safeParse(item);

            if (!parsedItem.success) {
                logger.warn("Error parsing item");
                logger.warn(parsedItem.error.format());

                putMetricData(`custom/${namespace}`, [
                    { MetricName: "MakeFilteredPtSituationArrayParseError", Value: 1 },
                ]);
            }

            return parsedItem.success;
        });
    }, z.array(ptSituationElementSchema));

export const situationsSchema = z.object({
    PtSituationElement: makeFilteredPtSituationArraySchema("SiriSxPtSituationArraySchema"),
});

export const situationExchangeDeliverySchema = z.object({
    ResponseTimestamp: datetimeSchema,
    Status: booleanStringSchema.optional(),
    ShortestPossibleCycle: z.string().optional(),
    Situations: situationsSchema,
});

export const serviceDeliverySchema = z.object({
    ResponseTimestamp: datetimeSchema,
    ProducerRef: z.string().optional(),
    ResponseMessageIdentifier: z.string().optional(),
    SituationExchangeDelivery: situationExchangeDeliverySchema,
});

export const siriSxSchema = z.object({
    Siri: z.object({
        ServiceDelivery: serviceDeliverySchema,
    }),
});
