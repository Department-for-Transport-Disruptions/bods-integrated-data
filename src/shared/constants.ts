export const GTFS_FILE_SUFFIX = "_gtfs";

export enum RegionCode {
    "EA" = "EA",
    "EM" = "EM",
    "L" = "L",
    "NE" = "NE",
    "NW" = "NW",
    "S" = "S",
    "SE" = "SE",
    "SW" = "SW",
    "W" = "W",
    "WM" = "WM",
    "Y" = "Y",
    "ALL" = "ALL",
}

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
