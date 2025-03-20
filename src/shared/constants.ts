/**
 * Max decimal precision in JavaScript before scientific notation kicks in
 */
export const MAX_DECIMAL_PRECISION = 6;

export const GTFS_FILE_SUFFIX = "_gtfs";

export const regionCodes = ["E", "EA", "EM", "L", "NE", "NW", "S", "SE", "SW", "W", "WM", "Y", "ALL"] as const;

export type RegionCode = (typeof regionCodes)[number];

export const regionNames = [
    "england",
    "east_anglia",
    "east_midlands",
    "london",
    "north_east",
    "north_west",
    "scotland",
    "south_east",
    "south_west",
    "wales",
    "west_midlands",
    "yorkshire",
    "all",
] as const;

export type RegionName = (typeof regionNames)[number];

export const REGIONS: Record<
    RegionCode,
    { regionCode: RegionCode; regionName: RegionName; regionDisplayName: string }
> = {
    E: {
        regionCode: "E",
        regionName: "england",
        regionDisplayName: "England",
    },
    EA: {
        regionCode: "EA",
        regionName: "east_anglia",
        regionDisplayName: "East Anglia",
    },
    EM: {
        regionCode: "EM",
        regionName: "east_midlands",
        regionDisplayName: "East Midlands",
    },
    L: {
        regionCode: "L",
        regionName: "london",
        regionDisplayName: "London",
    },
    NE: {
        regionCode: "NE",
        regionName: "north_east",
        regionDisplayName: "North East",
    },
    NW: {
        regionCode: "NW",
        regionName: "north_west",
        regionDisplayName: "North West",
    },
    S: {
        regionCode: "S",
        regionName: "scotland",
        regionDisplayName: "Scotland",
    },
    SE: {
        regionCode: "SE",
        regionName: "south_east",
        regionDisplayName: "South East",
    },
    SW: {
        regionCode: "SW",
        regionName: "south_west",
        regionDisplayName: "South West",
    },
    W: {
        regionCode: "W",
        regionName: "wales",
        regionDisplayName: "Wales",
    },
    WM: {
        regionCode: "WM",
        regionName: "west_midlands",
        regionDisplayName: "West Midlands",
    },
    Y: {
        regionCode: "Y",
        regionName: "yorkshire",
        regionDisplayName: "Yorkshire",
    },
    ALL: {
        regionCode: "ALL",
        regionDisplayName: "All",
        regionName: "all",
    },
};

export const txcArrayProperties = [
    "ServicedOrganisation",
    "AnnotatedStopPointRef",
    "StopPoint",
    "RouteSectionRef",
    "RouteSection",
    "Route",
    "RouteLink",
    "JourneyPatternSection",
    "JourneyPatternSectionRefs",
    "Operator",
    "Garage",
    "Service",
    "Line",
    "Track",
    "JourneyPattern",
    "JourneyPatternTimingLink",
    "VehicleJourney",
    "VehicleJourneyTimingLink",
    "OtherPublicHoliday",
    "DateRange",
    "ServicedOrganisationRef",
    "WorkingDays",
];

export const nptgArrayProperties = ["AdministrativeArea", "NptgLocality", "Region"];

export const tflOperatorRef = "TFLO";
export const subscriptionStatuses = ["live", "error", "inactive"] as const;
export const avlValidationErrorLevels = ["CRITICAL", "NON-CRITICAL"] as const;

export const avlValidationErrorLevelMappings: Record<string, (typeof avlValidationErrorLevels)[number]> = {
    Bearing: "CRITICAL",
    BlockRef: "NON-CRITICAL",
    DestinationName: "NON-CRITICAL",
    DestinationRef: "CRITICAL",
    DirectionRef: "NON-CRITICAL",
    LineRef: "CRITICAL",
    MonitoredVehicleJourney: "CRITICAL",
    OperatorRef: "CRITICAL",
    OriginName: "NON-CRITICAL",
    OriginRef: "CRITICAL",
    ProducerRef: "CRITICAL",
    PublishedLineName: "NON-CRITICAL",
    RecordedAtTime: "CRITICAL",
    ResponseTimestamp: "CRITICAL",
    ValidUntilTime: "CRITICAL",
    VehicleJourneyRef: "CRITICAL",
    VehicleLocation: "CRITICAL",
    Longitude: "CRITICAL",
    Latitude: "CRITICAL",
    VehicleMonitoringDelivery: "CRITICAL",
    Occupancy: "NON-CRITICAL",
};

export const avlOccupancyValues = ["full", "seatsAvailable", "standingAvailable"] as const;

export type AvlOccupancy = (typeof avlOccupancyValues)[number];

export const siriSxArrayProperties = [
    "PtSituationElement",
    "ValidityPeriod",
    "RelatedToRef",
    "InfoLink",
    "DayType",
    "Consequence",
    "AffectedNetwork",
    "AffectedOperator",
    "AffectedLine",
    "AffectedPlace",
    "AffectedStopPoint",
    "AffectedVehicleJourney",
    "Call",
    "Facility",
    "JourneyPartInfo",
    "Origins",
    "Destinations",
];
