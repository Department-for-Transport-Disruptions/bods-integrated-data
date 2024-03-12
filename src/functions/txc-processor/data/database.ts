import { Database, NewCalendar, notEmpty } from "@bods-integrated-data/shared";
import {
    OperatingPeriod,
    OperatingProfile,
    Operator,
    Service,
    VehicleJourney,
} from "@bods-integrated-data/shared/schema";
import { Kysely } from "kysely";
import uniq from "lodash/uniq";

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

const formatCalendar = (
    operatingProfile: OperatingProfile,
    operatingPeriod: OperatingPeriod,
    serviceId: number,
): NewCalendar => {
    const {
        RegularDayType: { DaysOfWeek: day },
    } = operatingProfile;

    return {
        serviceId,
        monday:
            day.Monday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        tuesday:
            day.Tuesday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        wednesday:
            day.Wednesday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        thursday:
            day.Thursday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        friday:
            day.Friday !== undefined ||
            day.MondayToFriday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.NotSaturday !== undefined
                ? 1
                : 0,
        saturday:
            day.Saturday !== undefined ||
            day.MondayToSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.Weekend !== undefined
                ? 1
                : 0,
        sunday:
            day.Sunday !== undefined ||
            day.NotSaturday !== undefined ||
            day.MondayToSunday !== undefined ||
            day.Weekend !== undefined
                ? 1
                : 0,
        startDate: operatingPeriod.StartDate,
        endDate: operatingPeriod.EndDate ?? null,
    };
};

export const insertCalendar = async (
    dbClient: Kysely<Database>,
    services: Service[],
    vehicleJourneys: VehicleJourney[],
) => {
    const calendarPromises = services.map(async (service) => {
        const dbService = await dbClient
            .insertInto("service_new")
            .values({ serviceCode: service.ServiceCode })
            .returningAll()
            .executeTakeFirstOrThrow();

        const operatingPeriod = service.OperatingPeriod;
        const defaultOperatingProfile = service.OperatingProfile
            ? formatCalendar(service.OperatingProfile, operatingPeriod, dbService.id)
            : null;

        const vehicleJourneyOperatingProfiles = vehicleJourneys
            .filter((journey) => journey.ServiceRef === service.ServiceCode)
            .map((journey): NewCalendar | null =>
                journey.OperatingProfile
                    ? formatCalendar(journey.OperatingProfile, operatingPeriod, dbService.id)
                    : defaultOperatingProfile,
            )
            .filter(notEmpty);

        const uniqueOperatingProfiles = uniq(vehicleJourneyOperatingProfiles);

        return dbClient.insertInto("calendar_new").values(uniqueOperatingProfiles);
    });

    return Promise.all(calendarPromises);
};
