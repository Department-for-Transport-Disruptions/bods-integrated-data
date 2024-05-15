export const GTFS_FILE_SUFFIX = "_gtfs";

export const regionCodes = ["EA", "EM", "L", "NE", "NW", "S", "SE", "SW", "W", "WM", "Y", "ALL"] as const;

export type RegionCode = (typeof regionCodes)[number];

export const REGION_MAPPINGS: { [key in RegionCode]: string } = {
    ALL: "All",
    EA: "East Anglia",
    EM: "East Midlands",
    L: "London",
    S: "Scotland",
    SE: "South East",
    SW: "South West",
    NE: "North East",
    NW: "North West",
    W: "Wales",
    WM: "West Midlands",
    Y: "Yorkshire",
};
