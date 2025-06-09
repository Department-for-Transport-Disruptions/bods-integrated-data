export const observationImportance = ["critical", "advisory"] as const;

export const observationCategory = ["dataset", "stop", "timing", "journey"] as const;

export const observationType = [
    "Duplicate journey code",
    "Duplicate journey",
    "First stop is not a timing point",
    "First stop is set down only",
    "Incorrect stop type",
    "Last stop is not a timing point",
    "Last stop is pick up only",
    "Missing bus working number",
    "Missing journey code",
    "No timing point for more than 15 minutes",
    "Serviced organisation data is out of date",
    "Stop not found in NaPTAN",
] as const;

export const allowedLastStopActivity = ["setDown", "setDownDriverRequest", "pickUpAndSetDown"];

export const allowedFirstStopActivity = ["pickUp", "pickUpDriverRequest", "pickUpAndSetDown"];

export const allowedStopTypes = ["BCT", "BCQ", "BCS", "BCE", "BST"];

export const allowedTimingPointValues = ["PTP", "principalTimingPoint"];
