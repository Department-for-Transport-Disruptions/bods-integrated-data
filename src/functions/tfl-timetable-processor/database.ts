import {
    Database,
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
import { chunkArray } from "@bods-integrated-data/shared/utils";

const insertAsChunks = async <T>(dbClient: KyselyDb, tableName: keyof Database, items: T[]) => {
    const chunks = chunkArray(items, 3000);

    await Promise.all(
        chunks.map((chunk) =>
            dbClient
                .insertInto(tableName)
                .values(chunk)
                .onConflict((oc) => oc.column("id").doNothing())
                .execute(),
        ),
    );
};

export const insertTflVehicles = async (dbClient: KyselyDb, tflVehicles: TflVehicle[]) => {
    if (tflVehicles.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflVehicles.length} vehicles`);
    await insertAsChunks(dbClient, "tfl_vehicle", tflVehicles);
};

export const insertTflOperators = async (dbClient: KyselyDb, tflOperators: TflOperator[]) => {
    if (tflOperators.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflOperators.length} operators`);
    await insertAsChunks(dbClient, "tfl_operator", tflOperators);
};

export const insertTflGarages = async (dbClient: KyselyDb, tflGarages: TflGarage[]) => {
    if (tflGarages.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflGarages.length} garages`);
    await insertAsChunks(dbClient, "tfl_garage", tflGarages);
};

export const insertTflBlocks = async (dbClient: KyselyDb, tflBlocks: TflBlock[]) => {
    if (tflBlocks.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflBlocks.length} blocks`);
    await insertAsChunks(dbClient, "tfl_block", tflBlocks);
};

export const insertTflBlockCalendarDays = async (dbClient: KyselyDb, tflBlockCalendarDays: TflBlockCalendarDay[]) => {
    if (tflBlockCalendarDays.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflBlockCalendarDays.length} blockCalendarDays`);
    await insertAsChunks(dbClient, "tfl_block_calendar_day", tflBlockCalendarDays);
};

export const insertTflStopPoints = async (dbClient: KyselyDb, tflStopPoints: TflStopPoint[]) => {
    if (tflStopPoints.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflStopPoints.length} stopPoints`);
    await insertAsChunks(dbClient, "tfl_stop_point", tflStopPoints);
};

export const insertTflDestinations = async (dbClient: KyselyDb, tflDestinations: TflDestination[]) => {
    if (tflDestinations.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflDestinations.length} destinations`);
    await insertAsChunks(dbClient, "tfl_destination", tflDestinations);
};

export const insertTflRouteGeometries = async (dbClient: KyselyDb, tflRouteGeometries: TflRouteGeometry[]) => {
    if (tflRouteGeometries.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflRouteGeometries.length} routeGeometries`);
    await insertAsChunks(dbClient, "tfl_route_geometry", tflRouteGeometries);
};

export const insertTflLines = async (dbClient: KyselyDb, tflLines: TflLine[]) => {
    if (tflLines.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflLines.length} lines`);
    await insertAsChunks(dbClient, "tfl_line", tflLines);
};

export const insertTflPatterns = async (dbClient: KyselyDb, tflPatterns: TflPattern[]) => {
    if (tflPatterns.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflPatterns.length} patterns`);
    await insertAsChunks(dbClient, "tfl_pattern", tflPatterns);
};

export const insertTflStopInPatterns = async (dbClient: KyselyDb, tflStopInPatterns: TflStopInPattern[]) => {
    if (tflStopInPatterns.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflStopInPatterns.length} stopInPatterns`);
    await insertAsChunks(dbClient, "tfl_stop_in_pattern", tflStopInPatterns);
};

export const insertTflJourneys = async (dbClient: KyselyDb, tflJourneys: TflJourney[]) => {
    if (tflJourneys.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflJourneys.length} journeys`);
    await insertAsChunks(dbClient, "tfl_journey", tflJourneys);
};

export const insertTflJourneyWaitTimes = async (dbClient: KyselyDb, tflJourneyWaitTimes: TflJourneyWaitTime[]) => {
    if (tflJourneyWaitTimes.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflJourneyWaitTimes.length} journeyWaitTimes`);
    await insertAsChunks(dbClient, "tfl_journey_wait_time", tflJourneyWaitTimes);
};

export const insertTflJourneyDriveTimes = async (dbClient: KyselyDb, tflJourneyDriveTimes: TflJourneyDriveTime[]) => {
    if (tflJourneyDriveTimes.length === 0) {
        return [];
    }

    logger.info(`Inserting ${tflJourneyDriveTimes.length} journeyDriveTimes`);
    await insertAsChunks(dbClient, "tfl_journey_drive_time", tflJourneyDriveTimes);
};
