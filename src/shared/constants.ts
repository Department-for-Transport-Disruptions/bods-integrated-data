export const REQUEST_PARAM_MAX_LENGTH = 256;

// TXC and SIRI-VM use the XML NMTOKEN data type for various properties: https://www.w3.org/TR/xml/#NT-Nmtoken
export const NM_TOKEN_REGEX = /^[a-zA-Z0-9.\-_:]{1,100}$/;
export const NM_TOKEN_ARRAY_REGEX = /^[a-zA-Z0-9.\-_:]{1,100}(,[a-zA-Z0-9.\-_:]{1,100})*$/;

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

export const tflOperatorRef = "TFLO";
export const avlSubscriptionStatuses = ["LIVE", "ERROR", "INACTIVE"] as const;
