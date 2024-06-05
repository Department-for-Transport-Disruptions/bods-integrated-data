import { logger } from "@baselime/lambda-logger";
import {
    KyselyDb,
    NewAgency,
    NewCalendar,
    NewCalendarDate,
    NewFrequency,
    NewRoute,
    NewShape,
    NewStop,
    NewStopTime,
    NewTrip,
} from "@bods-integrated-data/shared/database";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { BackoffOptions, backOff } from "exponential-backoff";

const retryBackOffOptions: BackoffOptions = {
    jitter: "full",
    numOfAttempts: 20,
    retry: (e, attemptNumber) => {
        logger.warn(`Attempt ${attemptNumber} failed, ${attemptNumber < 20 ? "retrying" : "aborting"}...`, e as Error);

        return true;
    },
};

export const getAgency = (dbClient: KyselyDb, nationalOperatorCode: string) => {
    return dbClient.selectFrom("agency").selectAll().where("noc", "=", nationalOperatorCode).executeTakeFirst();
};

export const getOperator = (dbClient: KyselyDb, nationalOperatorCode: string) => {
    return dbClient
        .selectFrom("noc_operator_new")
        .selectAll()
        .where("noc", "=", nationalOperatorCode)
        .executeTakeFirst();
};

export const insertAgency = async (dbClient: KyselyDb, agency: NewAgency) => {
    return dbClient
        .insertInto("agency")
        .values(agency)
        .onConflict((oc) => oc.column("noc").doUpdateSet(agency))
        .returningAll()
        .executeTakeFirst();
};

export const insertCalendars = async (dbClient: KyselyDb, calendars: NewCalendar[]) => {
    const calendarChunks = chunkArray(
        calendars.sort((a, b) => a.calendar_hash.localeCompare(b.calendar_hash)),
        3000,
    );

    const insertedCalendars = (
        await Promise.all(
            calendarChunks.map((chunk) =>
                backOff(
                    () =>
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
                    retryBackOffOptions,
                ),
            ),
        )
    ).flat();

    if (!insertedCalendars?.length) {
        throw new Error("Calendars failed to insert");
    }

    return insertedCalendars;
};

export const insertCalendarDates = async (dbClient: KyselyDb, calendarDates: NewCalendarDate[]) => {
    const calendarDatesChunks = chunkArray(
        calendarDates.sort((a, b) => a.service_id - b.service_id || a.date.localeCompare(b.date)),
        3000,
    );

    await Promise.all(
        calendarDatesChunks.map((chunk) =>
            backOff(
                () =>
                    dbClient
                        .insertInto("calendar_date_new")
                        .values(chunk)
                        .onConflict((oc) => oc.doNothing())
                        .execute(),
                retryBackOffOptions,
            ),
        ),
    );
};

export const insertFrequencies = (dbClient: KyselyDb, frequencies: NewFrequency[]) => {
    return dbClient.insertInto("frequency_new").values(frequencies).returningAll().execute();
};

export const getNaptanStops = (dbClient: KyselyDb, atcoCodes: string[], useStopLocality: boolean) => {
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

export const getTndsRoute = (dbClient: KyselyDb, nocLineName: string) => {
    return dbClient.selectFrom("route").selectAll().where("noc_line_name", "=", nocLineName).executeTakeFirst();
};

export const insertRoutes = (dbClient: KyselyDb, routes: NewRoute[]) => {
    return dbClient
        .insertInto("route")
        .values(routes)
        .onConflict((oc) =>
            oc.column("line_id").doUpdateSet((eb) => ({
                route_short_name: eb.ref("excluded.route_short_name"),
                route_type: eb.ref("excluded.route_type"),
            })),
        )
        .returningAll()
        .execute();
};

export const insertStops = async (dbClient: KyselyDb, stops: NewStop[]) => {
    const insertChunks = chunkArray(
        stops.sort((a, b) => a.id.localeCompare(b.id)),
        3000,
    );
    await Promise.all(
        insertChunks.map((chunk) =>
            backOff(
                () =>
                    dbClient
                        .insertInto("stop_new")
                        .values(chunk)
                        .onConflict((oc) => oc.column("id").doNothing())
                        .returningAll()
                        .execute(),
                retryBackOffOptions,
            ),
        ),
    );
};

export const insertShapes = async (dbClient: KyselyDb, shapes: NewShape[]) => {
    const insertChunks = chunkArray(shapes, 3000);
    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("shape_new").values(chunk).execute()));
};

export const insertStopTimes = async (dbClient: KyselyDb, stopTimes: NewStopTime[]) => {
    const insertChunks = chunkArray(stopTimes, 3000);
    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("stop_time_new").values(chunk).execute()));
};

export const insertTrips = (dbClient: KyselyDb, trips: NewTrip[]) => {
    return dbClient.insertInto("trip_new").values(trips).returningAll().execute();
};
