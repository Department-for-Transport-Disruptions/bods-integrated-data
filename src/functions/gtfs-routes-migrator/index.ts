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

// type MigrationTables = {
//     route_migration: GtfsRouteTable;
//     trip_migration: GtfsTripTable;
// };

const regionNames = [
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
] as const;

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
    dbAgencyNocMap: Record<string, Agency>,
    dbRouteNocLineNameMap: Record<string, Route>,
    regionName: RegionName,
) => {
    const data = await getGtfsData(regionName);

    // Live datasets can contain invalid data, so filter out agencies and routes with missing vital keys
    const csvAgencies = data.csvAgencies.filter((agency) => agency.agency_noc);
    const csvRoutes = data.csvRoutes.filter((route) => route.agency_id);

    const csvAgencyMap: Record<string, string> = {};

    for (const agency of csvAgencies) {
        csvAgencyMap[agency.agency_id] = agency.agency_noc;
    }

    const newRoutes: Route[] = [];
    const invalidAgencyIds = new Set<string>();
    const unknownAgencyIds = new Set<string>();

    for (const route of csvRoutes) {
        const noc = csvAgencyMap[route.agency_id];

        if (!noc) {
            invalidAgencyIds.add(route.agency_id);
            continue;
        }

        const nocLineName = `${noc}${route.route_short_name}`;
        const existingRoute = dbRouteNocLineNameMap[nocLineName];

        if (existingRoute) {
            newRoutes.push({
                ...existingRoute,
                id: route.route_id,
            });
        } else {
            const existingAgency = dbAgencyNocMap[noc];

            if (!existingAgency) {
                // todo: can we add new agencies and their routes instead of ignoring the routes?
                unknownAgencyIds.add(route.agency_id);
                continue;
            }

            newRoutes.push({
                id: route.route_id,
                agency_id: dbAgencyNocMap[noc].id,
                route_short_name: route.route_short_name,
                route_long_name: route.route_long_name,
                route_type: route.route_type,
                line_id: `?-${randomUUID()}`, // cannot be inferred
                data_source: "bods", // cannot be inferred
                noc_line_name: nocLineName,
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
        const dbAgencyNocMap: Record<string, Agency> = {};

        for (const agency of dbAgencies) {
            dbAgencyNocMap[agency.noc] = agency;
        }

        const dbRoutes = await dbClient.selectFrom("route").selectAll().execute();
        const dbRouteNocLineNameMap: Record<string, Route> = {};

        for (const route of dbRoutes) {
            dbRouteNocLineNameMap[route.noc_line_name] = route;
        }

        let allInvalidAgencyIds = new Set<string>();
        let allUnknownAgencyIds = new Set<string>();
        const allNewRoutes: Record<string, Route> = {};

        for await (const regionName of regionNames) {
            logger.info(`Getting GTFS data for region: ${regionName}`);

            const { newRoutes, invalidAgencyIds, unknownAgencyIds } = await getNewRoutes(
                dbAgencyNocMap,
                dbRouteNocLineNameMap,
                regionName,
            );

            allInvalidAgencyIds = new Set<string>([...allInvalidAgencyIds, ...invalidAgencyIds]);
            allUnknownAgencyIds = new Set<string>([...allUnknownAgencyIds, ...unknownAgencyIds]);

            for (const route of newRoutes) {
                if (!allNewRoutes[route.id]) {
                    allNewRoutes[route.id] = route;
                }
            }
        }

        // todo: we should also be insert all the existing DB routes that have not been matched
        const newRoutesSorted = Object.values(allNewRoutes).sort((a, b) => a.id - b.id);
        logger.info(`Inserting ${newRoutesSorted.length} new routes`);

        const insertChunks = chunkArray(newRoutesSorted, 3000);

        for await (const chunk of insertChunks) {
            await dbClient
                // todo: update typings
                // @ts-ignore temporary ts-ignore until the table is added to the typings
                .insertInto("route_migration")
                .values(chunk)
                .onConflict((oc) => oc.doNothing())
                .execute();
        }

        // todo: update trips table with route ids
        // todo: once we're happy with the migration rules, move the route_migration and trip_migration tables to the route and trip tables as the final step

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
