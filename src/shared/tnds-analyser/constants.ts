export const observationImportance = ["critical", "advisory"] as const;

export const observationCategory = ["dataset", "stop", "timing", "journey"] as const;

export const observationType = [
    "No timing point for more than 15 minutes",
    "First stop is not a timing point",
    "Last stop is not a timing point",
    "Last stop is pick up only",
    "First stop is set down only",
    "Stop not found in NaPTAN",
    "Incorrect stop type",
    "Missing journey code",
    "Duplicate journey code",
    "Duplicate journey",
    "Missing bus working number",
    "Serviced organisation out of date",
] as const;

export const allowedLastStopActivity = ["setDown", "setDownDriverRequest", "pickUpAndSetDown"];

export const allowedFirstStopActivity = ["pickUp", "pickUpDriverRequest", "pickUpAndSetDown"];

export const allowedStopTypes = ["BCT", "BCQ", "BCS", "BCE", "BST"];

export const allowedTimingPointValues = ["PTP", "PrincipalTimingPoint"];
