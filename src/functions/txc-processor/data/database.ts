import { Database, NewCalendar, notEmpty } from "@bods-integrated-data/shared";
import { Operator, Service, VehicleJourney } from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import isEqual from "lodash/isEqual";
import uniqWith from "lodash/uniqWith";
import { formatCalendar } from "../utils";

export const insertAgencies = async (dbClient: Kysely<Database>, operators: Operator[]) => {
    const agencyPromises = operators.map(async (operator) => {
        const existingAgency = await dbClient
            .selectFrom("agency")
            .selectAll()
            .where("noc", "=", operator.NationalOperatorCode)
            .executeTakeFirst();

        return dbClient
            .insertInto("agency_new")
            .values(
                existingAgency || {
                    name: operator.OperatorShortName,
                    noc: operator.NationalOperatorCode,
                    url: "",
                },
            )
            .onConflict((oc) => oc.column("noc").doUpdateSet({ name: operator.OperatorShortName }))
            .returningAll()
            .executeTakeFirst();
    });

    const agencyData = await Promise.all(agencyPromises);

    return agencyData.filter(notEmpty);
};

export const insertCalendarRecords = async (
    dbClient: Kysely<Database>,
    services: Service[],
    vehicleJourneys: VehicleJourney[],
) => {
    const servicePromises = services.map(async (service) => {
        const operatingPeriod = service.OperatingPeriod;
        const defaultOperatingProfile = service.OperatingProfile
            ? formatCalendar(service.OperatingProfile, operatingPeriod)
            : null;

        const vehicleJourneyOperatingProfiles = vehicleJourneys
            .filter((journey) => journey.ServiceRef === service.ServiceCode)
            .map((journey): NewCalendar | null =>
                journey.OperatingProfile
                    ? formatCalendar(journey.OperatingProfile, operatingPeriod)
                    : defaultOperatingProfile,
            )
            .filter(notEmpty);

        const uniqueOperatingProfiles = uniqWith(vehicleJourneyOperatingProfiles, isEqual);

        if (!uniqueOperatingProfiles.length) {
            return null;
        }

        await dbClient.insertInto("calendar_new").values(uniqueOperatingProfiles).execute();
    });

    await Promise.all(servicePromises.filter(notEmpty));
};
