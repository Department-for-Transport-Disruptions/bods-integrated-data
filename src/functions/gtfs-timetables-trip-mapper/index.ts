import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItems } from "@bods-integrated-data/shared/dynamo";
import {
    MatchedTrip,
    createTimetableMatchingLookup,
    retrieveMatchableTimetableData,
} from "@bods-integrated-data/shared/gtfs-rt/utils";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";

let dbClient: KyselyDb;

type GtfsTripMap = {
    PK: string;
    SK: string;
    tripId?: string;
    routeId?: number;
    revision?: number;
    timeToExist: number;
};

const mapMatchingTrip = (
    tripKey: string,
    priority: number,
    matchedTrip: MatchedTrip,
    timeToExist: number,
): GtfsTripMap => ({
    PK: matchedTrip.route_key,
    SK: `${tripKey}#${priority}`,
    tripId: matchedTrip.trip_id,
    routeId: matchedTrip.route_id,
    revision: matchedTrip.revision,
    timeToExist,
});

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { STAGE, GTFS_TRIP_MAPS_TABLE_NAME } = process.env;

        if (!STAGE || !GTFS_TRIP_MAPS_TABLE_NAME) {
            throw new Error("Missing env vars - STAGE and GTFS_TRIP_MAPS_TABLE_NAME must be set");
        }

        dbClient = dbClient || (await getDatabaseClient(STAGE === "local"));

        const timetableData = await retrieveMatchableTimetableData(dbClient);

        const { matchedTrips, matchedTripsWithOriginAndDestination, matchedTripsWithDepartureTime } =
            createTimetableMatchingLookup(timetableData);

        const gtfsMatchedTrips: GtfsTripMap[] = [];
        const timeToExist = getDate().add(1, "days").unix();

        for (const tripKey of Object.keys(matchedTrips)) {
            const matchedTrip = matchedTrips[tripKey];

            if (matchedTrip) {
                gtfsMatchedTrips.push(mapMatchingTrip(tripKey, 1, matchedTrip, timeToExist));
            }
        }

        for (const tripKey of Object.keys(matchedTripsWithOriginAndDestination)) {
            const matchedTrip = matchedTrips[tripKey];

            if (matchedTrip) {
                gtfsMatchedTrips.push(mapMatchingTrip(tripKey, 2, matchedTrip, timeToExist));
            }
        }

        for (const tripKey of Object.keys(matchedTripsWithDepartureTime)) {
            const matchedTrip = matchedTrips[tripKey];

            if (matchedTrip) {
                gtfsMatchedTrips.push(mapMatchingTrip(tripKey, 3, matchedTrip, timeToExist));
            }
        }

        await putDynamoItems(GTFS_TRIP_MAPS_TABLE_NAME, gtfsMatchedTrips);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the gtfs-timetables-trip-mapper function");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
