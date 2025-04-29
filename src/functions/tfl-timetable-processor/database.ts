import {
    KyselyDb,
    TflBlock,
    TflBlockCalendarDay,
    TflDestination,
    TflGarage,
    TflJourney,
    TflJourneyDriveTime,
    TflJourneyWaitTime,
    TflLine,
    TflOperator,
    TflPattern,
    TflRouteGeometry,
    TflStopInPattern,
    TflStopPoint,
    TflVehicle,
} from "@bods-integrated-data/shared/database";
import { logger } from "@bods-integrated-data/shared/logger";

export const insertTflVehicles = (dbClient: KyselyDb, tflVehicles: TflVehicle[]) => {
    if (tflVehicles.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflVehicles.length} vehicles`);

    return dbClient
        .insertInto("tfl_vehicle")
        .values(tflVehicles)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflOperators = (dbClient: KyselyDb, tflOperators: TflOperator[]) => {
    if (tflOperators.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflOperators.length} operators`);

    return dbClient
        .insertInto("tfl_operator")
        .values(tflOperators)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflGarages = (dbClient: KyselyDb, tflGarages: TflGarage[]) => {
    if (tflGarages.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflGarages.length} garages`);

    return dbClient
        .insertInto("tfl_garage")
        .values(tflGarages)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflBlocks = (dbClient: KyselyDb, tflBlocks: TflBlock[]) => {
    if (tflBlocks.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflBlocks.length} blocks`);

    return dbClient
        .insertInto("tfl_block")
        .values(tflBlocks)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflBlockCalendarDays = (dbClient: KyselyDb, tflBlockCalendarDays: TflBlockCalendarDay[]) => {
    if (tflBlockCalendarDays.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflBlockCalendarDays.length} blockCalendarDays`);

    return dbClient
        .insertInto("tfl_block_calendar_day")
        .values(tflBlockCalendarDays)
        .onConflict((oc) => oc.column("calendar_day").doNothing())
        .execute();
};

export const insertTflStopPoints = (dbClient: KyselyDb, tflStopPoints: TflStopPoint[]) => {
    if (tflStopPoints.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflStopPoints.length} stopPoints`);

    return dbClient
        .insertInto("tfl_stop_point")
        .values(tflStopPoints)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflDestinations = (dbClient: KyselyDb, tflDestinations: TflDestination[]) => {
    if (tflDestinations.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflDestinations.length} destinations`);

    return dbClient
        .insertInto("tfl_destination")
        .values(tflDestinations)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflRouteGeometries = (dbClient: KyselyDb, tflRouteGeometries: TflRouteGeometry[]) => {
    if (tflRouteGeometries.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflRouteGeometries.length} routeGeometries`);

    return dbClient
        .insertInto("tfl_route_geometry")
        .values(tflRouteGeometries)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflLines = (dbClient: KyselyDb, tflLines: TflLine[]) => {
    if (tflLines.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflLines.length} lines`);

    return dbClient
        .insertInto("tfl_line")
        .values(tflLines)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflPatterns = (dbClient: KyselyDb, tflPatterns: TflPattern[]) => {
    if (tflPatterns.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflPatterns.length} patterns`);

    return dbClient
        .insertInto("tfl_pattern")
        .values(tflPatterns)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflStopInPatterns = (dbClient: KyselyDb, tflStopInPatterns: TflStopInPattern[]) => {
    if (tflStopInPatterns.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflStopInPatterns.length} stopInPatterns`);

    return dbClient
        .insertInto("tfl_stop_in_pattern")
        .values(tflStopInPatterns)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflJourneys = (dbClient: KyselyDb, tflJourneys: TflJourney[]) => {
    if (tflJourneys.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflJourneys.length} journeys`);

    return dbClient
        .insertInto("tfl_journey")
        .values(tflJourneys)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflJourneyWaitTimes = (dbClient: KyselyDb, tflJourneyWaitTimes: TflJourneyWaitTime[]) => {
    if (tflJourneyWaitTimes.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflJourneyWaitTimes.length} journeyWaitTimes`);

    return dbClient
        .insertInto("tfl_journey_wait_time")
        .values(tflJourneyWaitTimes)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};

export const insertTflJourneyDriveTimes = (dbClient: KyselyDb, tflJourneyDriveTimes: TflJourneyDriveTime[]) => {
    if (tflJourneyDriveTimes.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflJourneyDriveTimes.length} journeyDriveTimes`);

    return dbClient
        .insertInto("tfl_journey_drive_time")
        .values(tflJourneyDriveTimes)
        .onConflict((oc) => oc.column("id").doNothing())
        .execute();
};
