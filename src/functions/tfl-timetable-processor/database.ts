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
    if (tflVehicles.length > 0) {
        logger.info(`Inserting ${tflVehicles.length} vehicles`);
        await insertAsChunks(dbClient, "tfl_vehicle_new", tflVehicles);
    }
};

export const insertTflOperators = async (dbClient: KyselyDb, tflOperators: TflOperator[]) => {
    if (tflOperators.length > 0) {
        logger.info(`Inserting ${tflOperators.length} operators`);
        await insertAsChunks(dbClient, "tfl_operator_new", tflOperators);
    }
};

export const insertTflGarages = async (dbClient: KyselyDb, tflGarages: TflGarage[]) => {
    if (tflGarages.length > 0) {
        logger.info(`Inserting ${tflGarages.length} garages`);
        await insertAsChunks(dbClient, "tfl_garage_new", tflGarages);
    }
};

export const insertTflBlocks = async (dbClient: KyselyDb, tflBlocks: TflBlock[]) => {
    if (tflBlocks.length > 0) {
        logger.info(`Inserting ${tflBlocks.length} blocks`);
        await insertAsChunks(dbClient, "tfl_block_new", tflBlocks);
    }
};

export const insertTflBlockCalendarDays = async (dbClient: KyselyDb, tflBlockCalendarDays: TflBlockCalendarDay[]) => {
    if (tflBlockCalendarDays.length > 0) {
        logger.info(`Inserting ${tflBlockCalendarDays.length} blockCalendarDays`);
        await insertAsChunks(dbClient, "tfl_block_calendar_day_new", tflBlockCalendarDays);
    }
};

export const insertTflStopPoints = async (dbClient: KyselyDb, tflStopPoints: TflStopPoint[]) => {
    if (tflStopPoints.length > 0) {
        logger.info(`Inserting ${tflStopPoints.length} stopPoints`);
        await insertAsChunks(dbClient, "tfl_stop_point_new", tflStopPoints);
    }
};

export const insertTflDestinations = async (dbClient: KyselyDb, tflDestinations: TflDestination[]) => {
    if (tflDestinations.length > 0) {
        logger.info(`Inserting ${tflDestinations.length} destinations`);
        await insertAsChunks(dbClient, "tfl_destination_new", tflDestinations);
    }
};

export const insertTflRouteGeometries = async (dbClient: KyselyDb, tflRouteGeometries: TflRouteGeometry[]) => {
    if (tflRouteGeometries.length > 0) {
        logger.info(`Inserting ${tflRouteGeometries.length} routeGeometries`);
        await insertAsChunks(dbClient, "tfl_route_geometry_new", tflRouteGeometries);
    }
};

export const insertTflLines = async (dbClient: KyselyDb, tflLines: TflLine[]) => {
    if (tflLines.length > 0) {
        logger.info(`Inserting ${tflLines.length} lines`);
        await insertAsChunks(dbClient, "tfl_line_new", tflLines);
    }
};

export const insertTflPatterns = async (dbClient: KyselyDb, tflPatterns: TflPattern[]) => {
    if (tflPatterns.length > 0) {
        logger.info(`Inserting ${tflPatterns.length} patterns`);
        await insertAsChunks(dbClient, "tfl_pattern_new", tflPatterns);
    }
};

export const insertTflStopInPatterns = async (dbClient: KyselyDb, tflStopInPatterns: TflStopInPattern[]) => {
    if (tflStopInPatterns.length > 0) {
        logger.info(`Inserting ${tflStopInPatterns.length} stopInPatterns`);
        await insertAsChunks(dbClient, "tfl_stop_in_pattern_new", tflStopInPatterns);
    }
};

export const insertTflJourneys = async (dbClient: KyselyDb, tflJourneys: TflJourney[]) => {
    if (tflJourneys.length > 0) {
        logger.info(`Inserting ${tflJourneys.length} journeys`);
        await insertAsChunks(dbClient, "tfl_journey_new", tflJourneys);
    }
};

export const insertTflJourneyWaitTimes = async (dbClient: KyselyDb, tflJourneyWaitTimes: TflJourneyWaitTime[]) => {
    if (tflJourneyWaitTimes.length > 0) {
        logger.info(`Inserting ${tflJourneyWaitTimes.length} journeyWaitTimes`);
        await insertAsChunks(dbClient, "tfl_journey_wait_time_new", tflJourneyWaitTimes);
    }
};

export const insertTflJourneyDriveTimes = async (dbClient: KyselyDb, tflJourneyDriveTimes: TflJourneyDriveTime[]) => {
    if (tflJourneyDriveTimes.length > 0) {
        logger.info(`Inserting ${tflJourneyDriveTimes.length} journeyDriveTimes`);
        await insertAsChunks(dbClient, "tfl_journey_drive_time_new", tflJourneyDriveTimes);
    }
};
