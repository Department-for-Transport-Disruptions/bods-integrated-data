import { CalendarDateExceptionType, Database, NewCalendar } from "@bods-integrated-data/shared/database";
import { BankHolidaysJson, getDate } from "@bods-integrated-data/shared/dates";
import { OperatingProfile, Service, VehicleJourney } from "@bods-integrated-data/shared/schema";
import { BankHolidayOperation } from "@bods-integrated-data/shared/schema/dates.schema";
import type { Kysely } from "kysely";
import MockDate from "mockdate";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    calculateDaysOfOperation,
    calculateServicedOrgDaysToUse,
    formatCalendar,
    formatCalendarDates,
    processCalendars,
    processServicedOrganisation,
} from "./calendar";
import * as database from "./database";

describe("calendar", () => {
    MockDate.set("2024-04-01T14:36:11+00:00");

    vi.mock("@bods-integrated-data/shared/schema/dates.schema", () => ({
        getTransformedBankHolidayOperationSchema: (_: BankHolidaysJson, schema: BankHolidayOperation) => {
            if (schema.ChristmasDay !== undefined) return ["20241225"];
            if (schema.BoxingDay !== undefined) return ["20241226"];
            return [];
        },
        DEFAULT_DATE_FORMAT: "YYYYMMDD",
    }));

    const defaultDaysOfOperation: NewCalendar = {
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 0,
        start_date: "20240401",
        end_date: "20240430",
    };

    const defaultVehicleJourney: VehicleJourney = {
        DepartureTime: "1200",
        JourneyPatternRef: "123",
        LineRef: "abc",
        ServiceRef: "123",
        VehicleJourneyCode: "1",
    };

    const defaultService: Service = {
        ServiceCode: "123",
        Lines: {
            Line: [
                {
                    "@_id": "abc",
                    LineName: "HELLO",
                },
            ],
        },
        OperatingPeriod: {
            StartDate: "2024-04-01",
        },
        Mode: "bus",
        RegisteredOperatorRef: "xyz",
        StandardService: {
            JourneyPattern: [
                {
                    "@_id": "123",
                    JourneyPatternSectionRefs: ["123"],
                },
            ],
        },
    };

    const bankHolidaysJson: BankHolidaysJson = {
        "england-and-wales": {
            division: "england-and-wales",
            events: [],
        },
        scotland: {
            division: "scotland",
            events: [],
        },
        "northern-ireland": {
            division: "northern-ireland",
            events: [],
        },
    };

    describe("formatCalendarDates", () => {
        it("filters out dates outside of the start and end date", () => {
            const startDate = getDate("2024-04-01");
            const endDate = getDate("2024-04-30");

            const formattedDates = formatCalendarDates(
                ["20240301", "20240321", "20240601"],
                startDate,
                endDate,
                CalendarDateExceptionType.ServiceAdded,
            );

            expect(formattedDates).toEqual([]);
        });

        it("formats dates correctly", () => {
            const startDate = getDate("2024-04-01");
            const endDate = getDate("2024-04-30");

            const formattedDates = formatCalendarDates(
                ["20240401", "20240321", "20240430"],
                startDate,
                endDate,
                CalendarDateExceptionType.ServiceAdded,
            );

            expect(formattedDates).toEqual([
                {
                    date: "20240401",
                    exception_type: 1,
                },
                {
                    date: "20240430",
                    exception_type: 1,
                },
            ]);
        });
    });

    describe("calculateDaysOfOperation", () => {
        it("returns default daysOfOperation if DaysOfWeek is empty", () => {
            const daysOfOperation = calculateDaysOfOperation("", getDate("2024-04-01"), getDate("2024-04-30"));

            expect(daysOfOperation).toEqual(defaultDaysOfOperation);
        });

        it.each<[OperatingProfile["RegularDayType"]["DaysOfWeek"], NewCalendar]>([
            [{ Weekend: "" }, { ...defaultDaysOfOperation, saturday: 1, sunday: 1 }],
            [
                { Monday: "", Tuesday: "", Thursday: "" },
                { ...defaultDaysOfOperation, monday: 1, tuesday: 1, thursday: 1 },
            ],
            [
                { NotMonday: "", NotTuesday: "" },
                { ...defaultDaysOfOperation, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1 },
            ],
            [
                { MondayToSunday: "" },
                {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 1,
                    sunday: 1,
                },
            ],
            [
                { MondayToSaturday: "" },
                {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 1,
                    sunday: 0,
                },
            ],
            [
                { MondayToFriday: "" },
                {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 0,
                    sunday: 0,
                },
            ],
        ])("returns correct daysOfOperation", (days, expectedDaysOfOperation) => {
            const daysOfOperation = calculateDaysOfOperation(days, getDate("2024-04-01"), getDate("2024-04-30"));

            expect(daysOfOperation).toEqual(expectedDaysOfOperation);
        });

        it("throws an error if day is undefined", () => {
            expect(() => calculateDaysOfOperation(undefined, getDate("2024-04-01"), getDate("2024-04-30"))).toThrow(
                "Invalid operating profile",
            );
        });
    });

    describe("calculateServicedOrgDaysToUse", () => {
        it("calculates days to use in range for given calendar", () => {
            const days = calculateServicedOrgDaysToUse(
                [getDate("2024-04-01"), getDate("2024-04-02"), getDate("2024-04-03"), getDate("2024-04-08")],
                { ...defaultDaysOfOperation, monday: 1, tuesday: 1 },
            );

            expect(days).toEqual(["20240401", "20240402", "20240408"]);
        });
    });

    describe("processServicedOrganisation", () => {
        it("gets list of working days for serviced organisation", () => {
            const servicedOrganisation = processServicedOrganisation(
                {
                    DaysOfOperation: {
                        WorkingDays: {
                            ServicedOrganisationRef: "123",
                        },
                    },
                    DaysOfNonOperation: {
                        WorkingDays: {
                            ServicedOrganisationRef: "abc",
                        },
                    },
                },
                [
                    {
                        OrganisationCode: "123",
                        WorkingDays: {
                            DateRange: [[getDate("2024-04-01"), getDate("2024-04-02"), getDate("2024-04-03")]],
                        },
                    },
                    {
                        OrganisationCode: "abc",
                        WorkingDays: {
                            DateRange: [[getDate("2024-03-04"), getDate("2024-04-01")]],
                        },
                    },
                ],
                {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    wednesday: 1,
                },
            );

            expect(servicedOrganisation).toEqual({
                servicedOrgDaysOfNonOperation: ["20240304", "20240401"],
                servicedOrgDaysOfOperation: ["20240401", "20240403"],
            });
        });

        it("gets list of holidays for serviced organisation", () => {
            const servicedOrganisation = processServicedOrganisation(
                {
                    DaysOfOperation: {
                        Holidays: {
                            ServicedOrganisationRef: "123",
                        },
                    },
                    DaysOfNonOperation: {
                        WorkingDays: {
                            ServicedOrganisationRef: "abc",
                        },
                        Holidays: {
                            ServicedOrganisationRef: "xyz",
                        },
                    },
                },
                [
                    {
                        OrganisationCode: "123",
                        Holidays: {
                            DateRange: [[getDate("2024-04-01"), getDate("2024-04-02"), getDate("2024-04-03")]],
                        },
                    },
                    {
                        OrganisationCode: "abc",
                        Holidays: {
                            DateRange: [[getDate("2024-03-04"), getDate("2024-04-01")]],
                        },
                    },
                    {
                        OrganisationCode: "xyz",
                        Holidays: {
                            DateRange: [[getDate("2024-05-04"), getDate("2024-05-01")]],
                        },
                    },
                ],
                {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    wednesday: 1,
                },
            );

            expect(servicedOrganisation).toEqual({
                servicedOrgDaysOfNonOperation: ["20240501"],
                servicedOrgDaysOfOperation: ["20240401", "20240403"],
            });
        });

        it("returns empty arrays if no matching serviced org found", () => {
            const servicedOrganisation = processServicedOrganisation(
                {
                    DaysOfOperation: {
                        WorkingDays: {
                            ServicedOrganisationRef: "123",
                        },
                    },
                },
                [
                    {
                        OrganisationCode: "abc",
                        WorkingDays: {
                            DateRange: [[getDate("2024-04-01")]],
                        },
                    },
                ],
                {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    wednesday: 1,
                },
            );

            expect(servicedOrganisation).toEqual({
                servicedOrgDaysOfNonOperation: [],
                servicedOrgDaysOfOperation: [],
            });
        });
    });

    describe("formatCalendar", () => {
        it("formats standard days calendar", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                },
                {
                    StartDate: "2024-04-01",
                },
                bankHolidaysJson,
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [],
            });
        });

        it("formats bank holiday days calendar", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                    BankHolidayOperation: {
                        DaysOfNonOperation: { ChristmasDay: "" },
                        DaysOfOperation: { BoxingDay: "" },
                    },
                },
                {
                    StartDate: "2024-04-01",
                },
                bankHolidaysJson,
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [
                    {
                        date: "20241226",
                        exception_type: 1,
                    },
                    {
                        date: "20241225",
                        exception_type: 2,
                    },
                ],
            });
        });

        it("formats special days calendar", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                    SpecialDaysOperation: {
                        DaysOfOperation: {
                            DateRange: [["20240401"]],
                        },
                        DaysOfNonOperation: {
                            DateRange: [["20240421"]],
                        },
                    },
                },
                {
                    StartDate: "2024-04-01",
                },
                bankHolidaysJson,
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [
                    {
                        date: "20240401",
                        exception_type: 1,
                    },
                    {
                        date: "20240421",
                        exception_type: 2,
                    },
                ],
            });
        });

        it("formats serviced organisations", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                    ServicedOrganisationDayType: {
                        DaysOfOperation: {
                            WorkingDays: {
                                ServicedOrganisationRef: "123",
                            },
                        },
                    },
                },
                {
                    StartDate: "2024-04-01",
                },
                bankHolidaysJson,
                [
                    {
                        OrganisationCode: "123",
                        WorkingDays: {
                            DateRange: [[getDate("2024-04-07")]],
                        },
                    },
                ],
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [
                    {
                        date: "20240407",
                        exception_type: 1,
                    },
                ],
            });
        });

        it("prioritises days of non operation if overlap", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                    SpecialDaysOperation: {
                        DaysOfOperation: {
                            DateRange: [["20240408"]],
                        },
                        DaysOfNonOperation: {
                            DateRange: [["20240407"]],
                        },
                    },
                    ServicedOrganisationDayType: {
                        DaysOfOperation: {
                            WorkingDays: {
                                ServicedOrganisationRef: "123",
                            },
                        },
                    },
                },
                {
                    StartDate: "2024-04-01",
                },
                bankHolidaysJson,
                [
                    {
                        OrganisationCode: "123",
                        WorkingDays: {
                            DateRange: [[getDate("2024-04-07")]],
                        },
                    },
                ],
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [
                    {
                        date: "20240408",
                        exception_type: 1,
                    },
                    {
                        date: "20240407",
                        exception_type: 2,
                    },
                ],
            });
        });

        it("sets start date to current date if operating period start date in past", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                },
                {
                    StartDate: "2024-03-01",
                },
                bankHolidaysJson,
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [],
            });
        });

        it("sets start date to operating period start date if operating period start date in future", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                },
                {
                    StartDate: "2024-04-10",
                },
                bankHolidaysJson,
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240410",
                    end_date: "20250110",
                },
                calendarDates: [],
            });
        });

        it("sets end date to operating period end date if set", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                },
                {
                    StartDate: "2024-03-01",
                    EndDate: "2024-04-30",
                },
                bankHolidaysJson,
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20240430",
                },
                calendarDates: [],
            });
        });

        it("sets end date to 9 months in the future if no operating period end date set", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            Weekend: "",
                        },
                    },
                },
                {
                    StartDate: "2024-06-04",
                },
                bankHolidaysJson,
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240604",
                    end_date: "20250304",
                },
                calendarDates: [],
            });
        });
    });

    describe("processCalendars", () => {
        const dbClientMock = vi.fn() as unknown as Kysely<Database>;
        vi.mock("./database.ts");

        const insertCalendarSpy = vi
            .spyOn(database, "insertCalendar")
            .mockResolvedValue({ ...defaultDaysOfOperation, calendar_hash: "hash", id: 1 });

        afterEach(() => {
            insertCalendarSpy.mockClear();
        });

        it("creates default calendar if no service or journey pattern level operating profile", async () => {
            await processCalendars(
                dbClientMock,
                defaultService,
                [
                    {
                        routeId: 1,
                        serviceId: 1,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: defaultVehicleJourney,
                    },
                ],
                bankHolidaysJson,
            );

            expect(insertCalendarSpy).toBeCalledTimes(1);
            expect(insertCalendarSpy).toBeCalledWith(dbClientMock, {
                calendar: {
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [],
            });
        });

        it("creates service level operating profile", async () => {
            await processCalendars(
                dbClientMock,
                {
                    ...defaultService,
                    OperatingProfile: {
                        RegularDayType: {
                            DaysOfWeek: {
                                MondayToFriday: "",
                            },
                        },
                        SpecialDaysOperation: {
                            DaysOfNonOperation: {
                                DateRange: [["20240401"]],
                            },
                        },
                    },
                },
                [
                    {
                        routeId: 1,
                        serviceId: 1,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: defaultVehicleJourney,
                    },
                ],
                bankHolidaysJson,
            );

            expect(insertCalendarSpy).toBeCalledTimes(1);
            expect(insertCalendarSpy).toBeCalledWith(dbClientMock, {
                calendar: {
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 0,
                    sunday: 0,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [
                    {
                        date: "20240401",
                        exception_type: 2,
                    },
                ],
            });
        });

        it("creates journey pattern level operating profile", async () => {
            await processCalendars(
                dbClientMock,
                defaultService,
                [
                    {
                        routeId: 1,
                        serviceId: 1,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: {
                            ...defaultVehicleJourney,
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Weekend: "",
                                    },
                                },
                                SpecialDaysOperation: {
                                    DaysOfNonOperation: {
                                        DateRange: [["20241225"]],
                                    },
                                },
                            },
                        },
                    },
                ],
                bankHolidaysJson,
            );

            expect(insertCalendarSpy).toBeCalledTimes(1);
            expect(insertCalendarSpy).toBeCalledWith(dbClientMock, {
                calendar: {
                    monday: 0,
                    tuesday: 0,
                    wednesday: 0,
                    thursday: 0,
                    friday: 0,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20250101",
                },
                calendarDates: [
                    {
                        date: "20241225",
                        exception_type: 2,
                    },
                ],
            });
        });

        it("returns serviceId in mapping", async () => {
            const processedCalendar = await processCalendars(
                dbClientMock,
                defaultService,
                [
                    {
                        routeId: 1,
                        serviceId: 1,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: {
                            ...defaultVehicleJourney,
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Weekend: "",
                                    },
                                },
                                SpecialDaysOperation: {
                                    DaysOfNonOperation: {
                                        DateRange: [["20241225"]],
                                    },
                                },
                            },
                        },
                    },
                ],
                bankHolidaysJson,
            );

            expect(processedCalendar[0].serviceId).toBe(1);
        });
    });
});
