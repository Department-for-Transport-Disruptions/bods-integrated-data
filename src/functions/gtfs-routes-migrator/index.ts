import { randomUUID } from "node:crypto";
import { Agency, KyselyDb, Route, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios from "axios";
import { sql } from "kysely";
import { parse } from "papaparse";
import { File, Open } from "unzipper";

type CsvAgency = {
    agency_id: string;
    agency_noc: string;
};

type CsvRoute = {
    route_id: number;
    agency_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type: number;
};

type DbAgencyNocMap = Record<string, Agency>;

type DbRouteNocLineNameMap = Record<
    string,
    {
        route: Route;
        isMatched: boolean;
    }
>;

type NewRouteMap = Record<
    number,
    {
        route: Route;
        existingRouteId?: number;
    }
>;

const regionNames = [
    // "england", // ignored since it encompasses all other regions except scotland and wales
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
] as const;

const regionCodeMap: Record<(typeof regionNames)[number], string> = {
    east_anglia: "EA",
    east_midlands: "EM",
    london: "L",
    north_east: "NE",
    north_west: "NW",
    scotland: "S",
    south_east: "SE",
    south_west: "SW",
    wales: "W",
    west_midlands: "WM",
    yorkshire: "Y",
};

type RegionName = (typeof regionNames)[number];

const getCsvData = async <T>(file: File) => {
    const content = await file.buffer();
    const contentString = content.toString();
    const parseResult = parse<CsvAgency>(contentString, { header: true });

    return parseResult.data as T[];
};

const getGtfsData = async (regionName: RegionName) => {
    const url = `https://data.bus-data.dft.gov.uk/timetable/download/gtfs-file/${regionName}`;
    const bufferResponse = await axios.get(url, { responseType: "arraybuffer" });
    const directory = await Open.buffer(bufferResponse.data);
    let csvAgencies: CsvAgency[] = [];
    let csvRoutes: CsvRoute[] = [];

    for await (const file of directory.files) {
        if (file.path === "agency.txt") {
            csvAgencies = await getCsvData<CsvAgency>(file);
        } else if (file.path === "routes.txt") {
            csvRoutes = await getCsvData<CsvRoute>(file);
        }
    }

    return { csvAgencies, csvRoutes };
};

const getNewRoutes = async (
    regionName: RegionName,
    dbAgencyNocMap: DbAgencyNocMap,
    dbRouteNocLineNameRegionMap: DbRouteNocLineNameMap,
) => {
    const data = await getGtfsData(regionName);

    // Live datasets can contain invalid data, so filter out agencies and routes with missing vital keys
    const csvAgencies = data.csvAgencies.filter((agency) => agency.agency_noc);
    const csvRoutes = data.csvRoutes.filter((route) => route.agency_id);

    const csvAgencyMap: Record<string, string> = {};

    for (const agency of csvAgencies) {
        csvAgencyMap[agency.agency_id] = agency.agency_noc;
    }

    const newRoutes: {
        route: Route;
        existingRouteId?: number;
    }[] = [];
    const invalidAgencyIds = new Set<string>();
    const unknownAgencyIds = new Set<string>();
    const regionCode = regionCodeMap[regionName];

    for (const route of csvRoutes) {
        const noc = csvAgencyMap[route.agency_id];

        if (!noc) {
            invalidAgencyIds.add(route.agency_id);
            continue;
        }

        const nocLineName = `${noc}${route.route_short_name}`;
        const nocLineNameRegion = `${nocLineName}${regionCode}`;
        const existingRoute =
            dbRouteNocLineNameRegionMap[nocLineNameRegion] || dbRouteNocLineNameRegionMap[nocLineName];

        if (existingRoute) {
            existingRoute.isMatched = true;
            newRoutes.push({
                route: {
                    ...existingRoute.route,
                    id: route.route_id,
                },
                existingRouteId: existingRoute.route.id,
            });
        } else {
            const existingAgency = dbAgencyNocMap[noc];

            if (!existingAgency) {
                unknownAgencyIds.add(route.agency_id);
                continue;
            }

            newRoutes.push({
                route: {
                    id: route.route_id,
                    agency_id: dbAgencyNocMap[noc].id,
                    route_short_name: route.route_short_name,
                    route_long_name: route.route_long_name,
                    route_type: route.route_type,
                    line_id: `?-${randomUUID()}`, // cannot be inferred
                    data_source: "bods", // cannot be inferred
                    noc_line_name: nocLineName,
                },
            });
        }
    }

    return { newRoutes, invalidAgencyIds, unknownAgencyIds };
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});
    let dbClient: KyselyDb | undefined = undefined;

    try {
        const { STAGE } = process.env;

        if (!STAGE) {
            throw new Error("Missing env vars - STAGE must be set");
        }

        dbClient = await getDatabaseClient(STAGE === "local");

        await dbClient.schema.dropTable("route_migration").ifExists().execute();
        await dbClient.schema.dropTable("trip_migration").ifExists().execute();
        await sql`CREATE TABLE ${sql.table("route_migration")} (LIKE ${sql.table("route")} INCLUDING ALL)`.execute(
            dbClient,
        );
        await sql`CREATE TABLE ${sql.table("trip_migration")} (LIKE ${sql.table("trip")} INCLUDING ALL)`.execute(
            dbClient,
        );

        const dbAgencies = await dbClient.selectFrom("agency").selectAll().execute();
        const dbRoutes = await dbClient.selectFrom("route").selectAll().execute();
        const dbTrips = await dbClient.selectFrom("trip").selectAll().execute();
        const dbRoutesAcrossMultipleRegions = (
            await sql<Route & { region_code: string }>`
WITH q1 AS (
    SELECT agency_id, noc_line_name, COUNT(*) as route_count
    FROM route
    WHERE route_type IN (3, 200)
    GROUP BY agency_id, noc_line_name
    ORDER BY route_count DESC
),
q2 AS (
    SELECT noc_line_name FROM q1 WHERE route_count > 1
),
q3 AS (
  SELECT * FROM route WHERE noc_line_name IN (SELECT noc_line_name FROM q2)
)
SELECT DISTINCT route.id, route.agency_id, route.route_short_name, route.route_long_name, route.noc_line_name, stop.region_code FROM route
JOIN trip ON trip.route_id = route.id
JOIN stop_time ON stop_time.trip_id = trip.id
JOIN stop ON stop.id = stop_time.stop_id
AND route.noc_line_name IN (SELECT noc_line_name FROM q3)`.execute(dbClient)
        ).rows;

        const dbAgencyNocMap: DbAgencyNocMap = {};
        const dbRouteNocLineNameRegionMap: DbRouteNocLineNameMap = {};
        const newRoutesMap: NewRouteMap = {};
        const allInvalidAgencyIds = new Set<string>();
        const allUnknownAgencyIds = new Set<string>();
        let highestNewRouteId = 0;
        let lowestNonMigratedRouteId = Number.MAX_SAFE_INTEGER;
        let newRouteInMultipleRegionsCount = 0;

        for (const agency of dbAgencies) {
            dbAgencyNocMap[agency.noc] = agency;
        }

        for (const route of dbRoutesAcrossMultipleRegions) {
            const nocLineNameRegion = `${route.noc_line_name}${route.region_code}`;

            dbRouteNocLineNameRegionMap[nocLineNameRegion] = {
                route,
                isMatched: false,
            };
        }

        for (const route of dbRoutes) {
            dbRouteNocLineNameRegionMap[route.noc_line_name] = {
                route,
                isMatched: false,
            };
        }

        for await (const regionName of regionNames) {
            logger.info(`Getting GTFS data for region: ${regionName}`);

            const { newRoutes, invalidAgencyIds, unknownAgencyIds } = await getNewRoutes(
                regionName,
                dbAgencyNocMap,
                dbRouteNocLineNameRegionMap,
            );

            for (const { route, existingRouteId } of newRoutes) {
                if (newRoutesMap[route.id]) {
                    newRouteInMultipleRegionsCount++;
                } else {
                    newRoutesMap[route.id] = {
                        route,
                        existingRouteId,
                    };

                    if (route.id > highestNewRouteId) {
                        highestNewRouteId = route.id;
                    }
                }
            }

            for (const invalidAgencyId of invalidAgencyIds) {
                allInvalidAgencyIds.add(invalidAgencyId);
            }

            for (const unknownAgencyId of unknownAgencyIds) {
                allUnknownAgencyIds.add(unknownAgencyId);
            }
        }

        const nonMigratedRouteMap: Record<number, Route> = {};

        for (const routeKey in dbRouteNocLineNameRegionMap) {
            const route = dbRouteNocLineNameRegionMap[routeKey];

            if (!route.isMatched) {
                nonMigratedRouteMap[route.route.id] = route.route;

                if (route.route.id < lowestNonMigratedRouteId) {
                    lowestNonMigratedRouteId = route.route.id;
                }
            }
        }

        const nonMigratedRouteIdIncrement = highestNewRouteId - lowestNonMigratedRouteId + 1;

        if (nonMigratedRouteIdIncrement > 0) {
            for (const routeKey in nonMigratedRouteMap) {
                nonMigratedRouteMap[routeKey].id += nonMigratedRouteIdIncrement;
            }
        }

        const newRoutes = Object.values(newRoutesMap);
        const newRouteByExistingRouteIdMap: Record<number, Route> = {};

        for (const { route, existingRouteId } of newRoutes) {
            if (existingRouteId) {
                newRouteByExistingRouteIdMap[existingRouteId] = route;
            }
        }

        let affectedTripCount = 0;

        for (const trip of dbTrips) {
            const nonMigratedRoute = nonMigratedRouteMap[trip.route_id];

            if (nonMigratedRoute) {
                trip.route_id = nonMigratedRoute.id;
                affectedTripCount++;
            } else {
                const newRoute = newRouteByExistingRouteIdMap[trip.route_id];

                if (newRoute) {
                    trip.route_id = newRoute.id;
                    affectedTripCount++;
                }
            }
        }

        const nonMigratedRoutes = Object.values(nonMigratedRouteMap);
        const routesToInsert = [...newRoutes.map(({ route }) => route), ...nonMigratedRoutes]
            .sort((a, b) => a.id - b.id)
            // necessary to remove the region_code from the DB route fetch
            .map<Route>((route) => ({
                id: route.id,
                agency_id: route.agency_id,
                route_short_name: route.route_short_name,
                route_long_name: route.route_long_name,
                route_type: route.route_type,
                line_id: route.line_id,
                data_source: route.data_source,
                noc_line_name: route.noc_line_name,
            }));

        logger.info(
            `Inserting ${routesToInsert.length} routes (${newRoutes.length} new, ${nonMigratedRoutes.length} non-migrated)`,
        );
        logger.info(`Number of new routes in multiple regions: ${newRouteInMultipleRegionsCount}`);

        const routeChunks = chunkArray(routesToInsert, 3000);

        for await (const chunk of routeChunks) {
            await dbClient
                // todo: once the migration is tested, the routes table will be truncated and the new routes will be inserted
                // @ts-ignore temporary ts-ignore until the migration is tested
                .insertInto("route_migration")
                .values(chunk)
                .onConflict((oc) => oc.doNothing())
                .execute();
        }

        logger.info(`Inserting ${dbTrips.length} trips (${affectedTripCount} affected)`);

        const tripChunks = chunkArray(dbTrips, 3000);

        for await (const chunk of tripChunks) {
            await dbClient
                // todo: once the migration is tested, the routes table will be truncated and the new routes will be inserted
                // @ts-ignore temporary ts-ignore until the migration is tested
                .insertInto("trip_migration")
                .values(chunk)
                .onConflict((oc) => oc.doNothing())
                .execute();
        }

        if (allInvalidAgencyIds.size) {
            logger.warn(
                `${allInvalidAgencyIds.size} invalid agency ids: ${Array.from(allInvalidAgencyIds).join(", ")}`,
            );
        }

        if (allUnknownAgencyIds.size) {
            logger.warn(
                `${allUnknownAgencyIds.size} unknown agency ids: ${Array.from(allUnknownAgencyIds).join(", ")}`,
            );
        }
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the gtfs-routes-migrator function");
        }

        throw e;
    } finally {
        if (dbClient) {
            await dbClient.destroy();
        }
    }
};
