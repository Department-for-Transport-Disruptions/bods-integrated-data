import {
    AbstractTimingLink,
    JourneyPattern,
    Service,
    TxcJourneyPatternSection,
} from "@bods-integrated-data/shared/schema";
import { SERVICE_CODE_PREFIX, TFLO_NOC } from "../constants";
import { TflIBusData } from "./db";

export const generateJourneyPatternSections = (
    patterns: TflIBusData["patterns"],
): { JourneyPatternSection: TxcJourneyPatternSection[] } => ({
    JourneyPatternSection: patterns.map<TxcJourneyPatternSection>((pattern, index) => ({
        "@_id": `JPS${index + 1}`,
        JourneyPatternTimingLink: pattern.stops.flatMap<AbstractTimingLink>((stop, stopIndex) => {
            if (stopIndex >= pattern.stops.length - 1) {
                return [];
            }

            return {
                "@_id": `JPTL${index + 1}-${stopIndex + 1}`,
                From: {
                    Activity: stopIndex === 0 ? "pickUp" : "pickUpAndSetDown",
                    StopPointRef: stop.atco_code,
                },
                To: {
                    Activity: stopIndex === pattern.stops.length - 2 ? "setDown" : "pickUpAndSetDown",
                    StopPointRef: pattern.stops[stopIndex + 1].atco_code,
                },
                RouteLinkRef: `RL${index + 1}-${stopIndex + 1}`,
                RunTime: "PT0M0S",
            };
        }),
    })),
});

export const getOriginAndDestination = (patterns: TflIBusData["patterns"]) => {
    const firstOutboundPattern = patterns.find((pattern) => pattern.direction === 1) ?? patterns[0];

    return {
        origin: firstOutboundPattern.stops[0].short_destination_name || firstOutboundPattern.stops[0].common_name,
        destination:
            firstOutboundPattern.stops[firstOutboundPattern.stops.length - 1].short_destination_name ||
            firstOutboundPattern.stops[firstOutboundPattern.stops.length - 1].common_name,
    };
};

export const getStartAndEndDates = (patterns: TflIBusData["patterns"]) => {
    const allCalendarDays = patterns
        .flatMap((pattern) =>
            pattern.journeys.flatMap((journey) => journey.calendar_days.flatMap((day) => day.calendar_day)),
        )
        .sort((a, b) => a.localeCompare(b));

    return {
        startDate: allCalendarDays[0],
        endDate: allCalendarDays[allCalendarDays.length - 1],
    };
};

export const generateServices = (patterns: TflIBusData["patterns"], lineId: string): { Service: Service } => {
    const { origin, destination } = getOriginAndDestination(patterns);
    const { startDate, endDate } = getStartAndEndDates(patterns);

    const serviceCode = `${SERVICE_CODE_PREFIX}${lineId}`;

    return {
        Service: {
            ServiceCode: serviceCode,
            Lines: {
                Line: [
                    {
                        "@_id": `${TFLO_NOC}:${serviceCode}:${lineId}`,
                        LineName: lineId,
                    },
                ],
            },
            OperatingPeriod: {
                StartDate: startDate,
                EndDate: endDate,
            },
            RegisteredOperatorRef: TFLO_NOC,
            StandardService: {
                Origin: origin,
                Destination: destination,
                JourneyPattern: patterns.map<JourneyPattern>((pattern, index) => ({
                    "@_id": `JP${index + 1}`,
                    Direction: pattern.direction === 1 ? "outbound" : "inbound",
                    RouteRef: `R${index + 1}`,
                    JourneyPatternSectionRefs: [`JPS${index + 1}`],
                })),
            },
        },
    };
};
