import {
    Database,
    NewCalendarDate,
    NewFrequency,
    NewRoute,
    NewShape,
    NewTrip,
    NewStop,
    NewAgency,
    NewStopTime,
    executeWithRetries,
} from "@bods-integrated-data/shared/database";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { CalendarWithDates } from "../types";

export const getAgency = async (dbClient: Kysely<Database>, nationalOperatorCode: string) => {
    return dbClient.selectFrom("agency").selectAll().where("noc", "=", nationalOperatorCode).executeTakeFirst();
};

export const getOperator = async (dbClient: Kysely<Database>, nationalOperatorCode: string) => {
    return dbClient
        .selectFrom("noc_operator_new")
        .selectAll()
        .where("noc", "=", nationalOperatorCode)
        .executeTakeFirst();
};

export const insertAgency = async (dbClient: Kysely<Database>, agency: NewAgency) => {
    return dbClient
        .insertInto("agency_new")
        .values(agency)
        .onConflict((oc) => oc.column("noc").doUpdateSet(agency))
        .returningAll()
        .executeTakeFirst();
};

export const insertCalendars = async (dbClient: Kysely<Database>, calendars: CalendarWithDates[]) => {
    const calendarChunks = chunkArray(
        calendars.map((c) => c.calendar),
        3000,
    );

    const insertedCalendars = (
        await Promise.all(
            calendarChunks.map((chunk) =>
                executeWithRetries(() =>
                    dbClient
                        .insertInto("calendar_new")
                        .values(chunk)
                        .onConflict((oc) =>
                            oc
                                .column("calendar_hash")
                                .doUpdateSet((eb) => ({ calendar_hash: eb.ref("excluded.calendar_hash") })),
                        )
                        .returningAll()
                        .execute(),
                ),
            ),
        )
    ).flat();

    if (!insertedCalendars?.length) {
        throw new Error("Calendars failed to insert");
    }

    return insertedCalendars;
};

export const insertCalendarDates = async (dbClient: Kysely<Database>, calendarDates: NewCalendarDate[]) => {
    const calendarDatesChunks = chunkArray(calendarDates, 3000);

    await Promise.all(
        calendarDatesChunks.map((chunk) =>
            executeWithRetries(() =>
                dbClient
                    .insertInto("calendar_date_new")
                    .values(chunk)
                    .onConflict((oc) => oc.doNothing())
                    .execute(),
            ),
        ),
    );
};

export const insertFrequencies = async (dbClient: Kysely<Database>, frequencies: NewFrequency[]) => {
    return dbClient.insertInto("frequency_new").values(frequencies).returningAll().execute();
};

export const getNaptanStops = (dbClient: Kysely<Database>, atcoCodes: string[], useStopLocality: boolean) => {
    if (useStopLocality) {
        return dbClient
            .selectFrom("naptan_stop_new")
            .leftJoin("nptg_locality_new", "nptg_locality_new.locality_code", "naptan_stop_new.nptg_locality_code")
            .leftJoin("nptg_admin_area_new", "nptg_admin_area_new.admin_area_code", "nptg_locality_new.admin_area_ref")
            .selectAll("naptan_stop_new")
            .select(["nptg_admin_area_new.region_code"])
            .where("naptan_stop_new.atco_code", "in", atcoCodes)
            .execute();
    }

    return dbClient
        .selectFrom("naptan_stop_new")
        .leftJoin(
            "nptg_admin_area_new",
            "nptg_admin_area_new.admin_area_code",
            "naptan_stop_new.administrative_area_code",
        )
        .selectAll("naptan_stop_new")
        .select(["nptg_admin_area_new.region_code"])
        .where("naptan_stop_new.atco_code", "in", atcoCodes)
        .execute();
};

export const getTndsRoute = (dbClient: Kysely<Database>, nocLineName: string) => {
    return dbClient.selectFrom("route_new").selectAll().where("noc_line_name", "=", nocLineName).executeTakeFirst();
};

export const insertRoute = (dbClient: Kysely<Database>, route: NewRoute) => {
    const { route_short_name, route_type } = route;

    return dbClient
        .insertInto("route_new")
        .values(route)
        .onConflict((oc) => oc.column("line_id").doUpdateSet({ route_short_name, route_type }))
        .returningAll()
        .executeTakeFirst();
};

export const insertStops = async (dbClient: Kysely<Database>, stops: NewStop[]) => {
    return executeWithRetries(() =>
        dbClient
            .insertInto("stop_new")
            .values(stops)
            .onConflict((oc) => oc.column("id").doNothing())
            .returningAll()
            .execute(),
    );
};

export const insertShapes = async (dbClient: Kysely<Database>, shapes: NewShape[]) => {
    const insertChunks = chunkArray(shapes, 3000);
    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("shape_new").values(chunk).execute()));
};

export const insertStopTimes = async (dbClient: Kysely<Database>, stopTimes: NewStopTime[]) => {
    const insertChunks = chunkArray(stopTimes, 3000);
    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("stop_time_new").values(chunk).execute()));
};

export const insertTrips = async (dbClient: Kysely<Database>, trips: NewTrip[]) => {
    return dbClient.insertInto("trip_new").values(trips).returningAll().execute();
};
