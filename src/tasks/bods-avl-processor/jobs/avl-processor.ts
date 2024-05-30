/* eslint-disable no-console */
import {
    Calendar,
    CalendarDateExceptionType,
    KyselyDb,
    NewAvl,
    getDatabaseClient,
} from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { generateGtfsRtFeed, getAvlDataForGtfs, mapAvlToGtfsEntity } from "@bods-integrated-data/shared/gtfs-rt/utils";
import { putS3Object } from "@bods-integrated-data/shared/s3";
import { siriSchemaTransformed } from "@bods-integrated-data/shared/schema/avl.schema";
import { DEFAULT_DATE_FORMAT } from "@bods-integrated-data/shared/schema/dates.schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import axios, { AxiosResponse } from "axios";
import { XMLParser } from "fast-xml-parser";
import { transit_realtime } from "gtfs-realtime-bindings";
import { sql } from "kysely";
import Pino from "pino";
import { Entry, Parse } from "unzipper";
import { Stream } from "stream";

const daysOfWeek: (keyof Calendar)[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const logger = Pino();

const {
    PROCESSOR_FREQUENCY_IN_SECONDS: processorFrequency,
    CLEARDOWN_FREQUENCY_IN_SECONDS: cleardownFrequency,
    BUCKET_NAME: bucketName,
    SAVE_JSON: saveJson,
} = process.env;

if (!processorFrequency || !cleardownFrequency || !bucketName) {
    throw new Error(
        "Missing env vars - BUCKET_NAME, PROCESSOR_FREQUENCY_IN_SECONDS and CLEARDOWN_FREQUENCY_IN_SECONDS must be set",
    );
}

const sanitiseTicketMachineJourneyCode = (input: string) => input.replace(":", "");

const uploadGtfsRtToS3 = async (bucketName: string, data: Uint8Array) => {
    try {
        await putS3Object({
            Bucket: bucketName,
            Key: "gtfs-rt.bin",
            ContentType: "application/octet-stream",
            Body: data,
        });
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem uploading GTFS-RT data to S3", error);
        }

        throw error;
    }
};

const generateGtfs = async () => {
    console.time("gtfsgenerate");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local", true);

    try {
        logger.info("Retrieving AVL from database...");
        const avlData = await getAvlDataForGtfs(dbClient);

        logger.info("Generating GTFS-RT...");
        const entities = avlData.map(mapAvlToGtfsEntity);
        const gtfsRtFeed = generateGtfsRtFeed(entities);

        await uploadGtfsRtToS3(bucketName, gtfsRtFeed);

        if (saveJson === "true") {
            const decodedJson = transit_realtime.FeedMessage.decode(gtfsRtFeed);

            await putS3Object({
                Bucket: bucketName,
                Key: "gtfs-rt.json",
                ContentType: "application/json",
                Body: JSON.stringify(decodedJson),
            });
        }

        console.timeEnd("gtfsgenerate");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error running the GTFS-RT Generator", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};

const uploadToDatabase = async (dbClient: KyselyDb, xml: string) => {
    const xmlParser = new XMLParser({
        numberParseOptions: {
            hex: false,
            leadingZeros: false,
        },
    });

    const parsedXml = xmlParser.parse(xml) as Record<string, unknown>;

    const parsedJson = siriSchemaTransformed.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error("There was an error parsing the AVL data", parsedJson.error.format());

        throw new Error("Error parsing data");
    }

    const currentDate = getDate();
    const currentDateIso = currentDate.toISOString();
    const currentDay = daysOfWeek[getDate().day()];

    const timetableData = await dbClient
        .selectFrom("agency")
        .innerJoin("route", "route.agency_id", "agency.id")
        .innerJoin("trip", "trip.route_id", "route.id")
        .innerJoin("calendar", (join) =>
            join
                .onRef("calendar.id", "=", "trip.service_id")
                .on("calendar.start_date", "<=", currentDateIso)
                .on("calendar.end_date", ">", currentDateIso),
        )
        .leftJoin("calendar_date", (join) =>
            join
                .onRef("calendar_date.service_id", "=", "trip.service_id")
                .on("calendar_date.date", "=", currentDate.format(DEFAULT_DATE_FORMAT)),
        )
        .select([
            "agency.noc",
            "route.id as route_id",
            "route.route_short_name",
            "trip.id as trip_id",
            "trip.ticket_machine_journey_code",
            "trip.direction",
        ])
        .where((eb) =>
            eb.or([
                eb("calendar_date.exception_type", "=", CalendarDateExceptionType.ServiceAdded),
                eb.and([eb(`calendar.${currentDay}`, "=", 1), eb("calendar_date.exception_type", "is", null)]),
            ]),
        )
        .execute();

    const lookup: {
        [key: string]: {
            noc: string;
            route_id: number;
            route_short_name: string;
            trips: Record<
                string,
                {
                    direction: string;
                    ticket_machine_journey_code: string | null;
                    trip_id: string;
                }
            >;
        };
    } = {};

    for (const item of timetableData) {
        const routeKey = `${item.noc}_${item.route_short_name}`;
        const tripKey = `${item.direction}_${sanitiseTicketMachineJourneyCode(item.ticket_machine_journey_code)}`;

        if (!lookup[routeKey]) {
            lookup[routeKey] = {
                noc: item.noc,
                route_id: item.route_id,
                route_short_name: item.route_short_name,
                trips: {},
            };
        }

        lookup[routeKey].trips[tripKey] = {
            direction: item.direction,
            ticket_machine_journey_code: item.ticket_machine_journey_code,
            trip_id: item.trip_id,
        };
    }

    const enrichedAvl: NewAvl[] = parsedJson.data.map((item) => {
        const matchingRoute =
            item.operator_ref && item.line_ref ? lookup[`${item.operator_ref}_${item.line_ref}`] : null;

        const matchingTrip =
            matchingRoute && item.direction_ref && item.dated_vehicle_journey_ref
                ? matchingRoute.trips[
                      `${item.direction_ref}_${sanitiseTicketMachineJourneyCode(item.dated_vehicle_journey_ref)}`
                  ]
                : null;

        return {
            ...item,
            route_id: matchingRoute?.route_id,
            trip_id: matchingTrip?.trip_id,
            geom:
                item.longitude && item.latitude
                    ? sql`ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)`
                    : null,
        };
    });

    const chunkedAvl = chunkArray(enrichedAvl, 2000);

    await Promise.all(
        chunkedAvl.map((chunk) =>
            dbClient
                .insertInto("avl_bods")
                .onConflict((oc) =>
                    oc
                        .columns(["vehicle_ref", "operator_ref", "recorded_at_time"])
                        .doUpdateSet((eb) => ({ valid_until_time: eb.ref("excluded.valid_until_time") })),
                )
                .values(chunk)
                .execute(),
        ),
    );
};

const unzipAndUploadToDatabase = async (dbClient: KyselyDb, avlResponse: AxiosResponse<Stream>) => {
    const zip = avlResponse.data.pipe(
        Parse({
            forceStream: true,
        }),
    );

    for await (const item of zip) {
        const entry = item as Entry;

        const fileName = entry.path;

        if (fileName === "siri.xml") {
            await uploadToDatabase(dbClient, (await entry.buffer()).toString());
        }

        entry.autodrain();
    }
};

void (async () => {
    console.time("avl-processor");

    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting BODS AVL processor");

        const avlResponse = await axios.get<Stream>("https://data.bus-data.dft.gov.uk/avl/download/bulk_archive", {
            responseType: "stream",
        });

        if (!avlResponse) {
            throw new Error("No AVL data found");
        }

        await unzipAndUploadToDatabase(dbClient, avlResponse);

        logger.info("BODS AVL processor successful");
        console.timeEnd("avl-processor");

        await generateGtfs();
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL retriever", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
})();
