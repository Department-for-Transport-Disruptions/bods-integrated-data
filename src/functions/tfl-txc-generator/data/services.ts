import {
    AbstractTimingLink,
    JourneyPattern,
    Service,
    TxcJourneyPatternSection,
} from "@bods-integrated-data/shared/schema";
import { TFLO_NOC } from "../constants";
import { getServiceCode, getTxcLineId } from "../utils";
import { TflIBusData } from "./db";

export const generateJourneyPatternSections = (
    patterns: TflIBusData["patterns"],
): { JourneyPatternSection: TxcJourneyPatternSection[] } => ({
    JourneyPatternSection: patterns.flatMap((pattern, patternIndex) => ({
        "@_id": `JPS${patternIndex + 1}`,
        JourneyPatternTimingLink: pattern.stops.flatMap<AbstractTimingLink>((stop, stopIndex) => {
            if (stopIndex === pattern.stops.length - 1) {
                return [];
            }

            const fromStop = stop;
            const toStop = pattern.stops[stopIndex + 1];

            return {
                "@_id": `JPTL${patternIndex + 1}-${stopIndex + 1}`,
                From: {
                    "@_SequenceNumber": stopIndex + 1,
                    Activity: stopIndex === 0 ? "pickUp" : "pickUpAndSetDown",
                    StopPointRef: fromStop.atco_code,
                    TimingStatus: fromStop.timing_point_code ? "principalTimingPoint" : "otherPoint",
                },
                To: {
                    "@_SequenceNumber": stopIndex + 2,
                    Activity: stopIndex === pattern.stops.length - 2 ? "setDown" : "pickUpAndSetDown",
                    StopPointRef: toStop.atco_code,
                    TimingStatus: toStop.timing_point_code ? "principalTimingPoint" : "otherPoint",
                },
                RouteLinkRef: `RL${patternIndex + 1}-${stopIndex + 1}`,
                RunTime: "PT0M0S",
            };
        }),
    })),
});

export const getOriginAndDestination = (pattern: TflIBusData["patterns"][0]) => ({
    origin: pattern.stops[0].short_destination_name || pattern.stops[0].common_name,
    destination:
        pattern.stops[pattern.stops.length - 1].short_destination_name ||
        pattern.stops[pattern.stops.length - 1].common_name,
});

export const getOriginAndDestinationFromListOfPatterns = (patterns: TflIBusData["patterns"]) => {
    const firstOutboundPattern = patterns.find((pattern) => pattern.direction === 1) ?? patterns[0];

    return getOriginAndDestination(firstOutboundPattern);
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
    const { origin, destination } = getOriginAndDestinationFromListOfPatterns(patterns);
    const { startDate, endDate } = getStartAndEndDates(patterns);

    return {
        Service: {
            ServiceCode: getServiceCode(lineId),
            Lines: {
                Line: [
                    {
                        "@_id": getTxcLineId(lineId),
                        LineName: lineId,
                        OutboundDescription: {
                            Origin: origin,
                            Destination: destination,
                            Description: `To ${destination}`,
                        },
                    },
                ],
            },
            OperatingPeriod: {
                StartDate: startDate,
                EndDate: endDate,
            },
            RegisteredOperatorRef: TFLO_NOC,
            PublicUse: "true",
            StandardService: {
                Origin: origin,
                Destination: destination,
                JourneyPattern: patterns.map<JourneyPattern>((pattern, index) => ({
                    "@_id": `JP${index + 1}`,
                    DestinationDisplay: getOriginAndDestination(pattern).destination,
                    OperatorRef: TFLO_NOC,
                    Direction: pattern.direction === 1 ? "outbound" : "inbound",
                    RouteRef: `R${index + 1}`,
                    JourneyPatternSectionRefs: [`JPS${index + 1}`],
                })),
            },
        },
    };
};
