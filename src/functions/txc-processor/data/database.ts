import {
    Database,
    NewCalendar,
    NewCalendarDate,
    NewFrequency,
    NewRoute,
    NewShape,
    NewTrip,
    NewStop,
    NewAgency,
    NewStopTime,
} from "@bods-integrated-data/shared/database";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { Kysely } from "kysely";
import { hasher } from "node-object-hash";

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

export const insertCalendar = async (
    dbClient: Kysely<Database>,
    calendarData: {
        calendar: NewCalendar;
        calendarDates: NewCalendarDate[];
    },
) => {
    const calendarHash = hasher().hash(calendarData);

    const insertedCalendar = await dbClient
        .insertInto("calendar_new")
        .values({ ...calendarData.calendar, calendar_hash: calendarHash })
        .onConflict((oc) => oc.column("calendar_hash").doUpdateSet({ ...calendarData.calendar }))
        .returningAll()
        .executeTakeFirst();

    if (!insertedCalendar?.id) {
        throw new Error("Calendar failed to insert");
    }

    if (!calendarData.calendarDates?.length) {
        return insertedCalendar;
    }

    const calendarDatesChunks = chunkArray(
        calendarData.calendarDates.map((date) => ({
            date: date.date,
            exception_type: date.exception_type,
            service_id: insertedCalendar.id,
        })),
        3000,
    );

    await Promise.all(
        calendarDatesChunks.map((chunk) =>
            dbClient
                .insertInto("calendar_date_new")
                .values(chunk)
                .onConflict((oc) => oc.doNothing())
                .execute(),
        ),
    );

    return insertedCalendar;
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
    return dbClient
        .insertInto("stop_new")
        .values(stops)
        .onConflict((oc) => oc.column("id").doNothing())
        .returningAll()
        .execute();
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
