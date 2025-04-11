import { CalendarDateExceptionType, KyselyDb, NewCalendar } from "@bods-integrated-data/shared/database";
import { BankHolidaysJson, getDate } from "@bods-integrated-data/shared/dates";
import { OperatingProfile, Service, VehicleJourney } from "@bods-integrated-data/shared/schema";
import { BankHolidayOperation } from "@bods-integrated-data/shared/schema/dates.schema";
import MockDate from "mockdate";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    calculateDaysOfOperation,
    calculateServicedOrgDaysToUse,
    formatCalendar,
    formatCalendarDates,
    isCalendarEmpty,
    mapVehicleJourneysToCalendars,
    processCalendarDates,
    processCalendars,
    processServicedOrganisation,
} from "./calendar";
import * as database from "./database";

describe("calendar", () => {
    MockDate.set("2024-04-01T14:36:11+00:00");

    const DEFAULT_HASH = "927fd813a3f84dcb748712795f691fb8188961ec1a3ecf6377e5de9bc6614840";

    const dbClientMock = {} as KyselyDb;
    vi.mock("./database.ts");

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
        calendar_hash: "",
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
        OperatingProfile: {
            RegularDayType: {
                DaysOfWeek: {
                    MondayToSunday: "",
                },
            },
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
                        WorkingDays: [
                            {
                                ServicedOrganisationRef: ["123"],
                            },
                        ],
                    },
                    DaysOfNonOperation: {
                        WorkingDays: [
                            {
                                ServicedOrganisationRef: ["abc"],
                            },
                        ],
                    },
                },
                [
                    {
                        OrganisationCode: "123",
                        WorkingDays: [
                            {
                                DateRange: [[getDate("2024-04-01"), getDate("2024-04-02"), getDate("2024-04-03")]],
                            },
                        ],
                    },
                    {
                        OrganisationCode: "abc",
                        WorkingDays: [
                            {
                                DateRange: [[getDate("2024-03-04"), getDate("2024-04-01")]],
                            },
                        ],
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
                            ServicedOrganisationRef: ["123"],
                        },
                    },
                    DaysOfNonOperation: {
                        WorkingDays: [
                            {
                                ServicedOrganisationRef: ["abc"],
                            },
                        ],
                        Holidays: {
                            ServicedOrganisationRef: ["xyz"],
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
                        WorkingDays: [
                            {
                                ServicedOrganisationRef: ["123"],
                            },
                        ],
                    },
                },
                [
                    {
                        OrganisationCode: "abc",
                        WorkingDays: [
                            {
                                DateRange: [[getDate("2024-04-01")]],
                            },
                        ],
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
                    calendar_hash: expect.any(String),
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
                    calendar_hash: expect.any(String),
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
                    calendar_hash: expect.any(String),
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
                            WorkingDays: [
                                {
                                    ServicedOrganisationRef: ["123"],
                                },
                            ],
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
                        WorkingDays: [
                            {
                                DateRange: [[getDate("2024-04-07")]],
                            },
                        ],
                    },
                ],
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    start_date: "20240401",
                    end_date: "20250101",
                    calendar_hash: expect.any(String),
                },
                calendarDates: [
                    {
                        date: "20240407",
                        exception_type: 1,
                    },
                ],
            });
        });

        it("formats serviced organisations with only days of non-operation", () => {
            const formattedCalendar = formatCalendar(
                {
                    RegularDayType: {
                        DaysOfWeek: {
                            MondayToFriday: "",
                        },
                    },
                    ServicedOrganisationDayType: {
                        DaysOfNonOperation: {
                            WorkingDays: [
                                {
                                    ServicedOrganisationRef: ["123"],
                                },
                            ],
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
                        WorkingDays: [
                            {
                                DateRange: [[getDate("2024-04-08")]],
                            },
                        ],
                    },
                ],
            );

            expect(formattedCalendar).toEqual({
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
                    calendar_hash: expect.any(String),
                },
                calendarDates: [
                    {
                        date: "20240408",
                        exception_type: 2,
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
                            WorkingDays: [
                                {
                                    ServicedOrganisationRef: ["123"],
                                },
                            ],
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
                        WorkingDays: [
                            {
                                DateRange: [[getDate("2024-04-07")]],
                            },
                        ],
                    },
                ],
            );

            expect(formattedCalendar).toEqual({
                calendar: {
                    ...defaultDaysOfOperation,
                    start_date: "20240401",
                    end_date: "20250101",
                    calendar_hash: expect.any(String),
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
                    calendar_hash: expect.any(String),
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
                    end_date: "20250101",
                    calendar_hash: expect.any(String),
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
                    calendar_hash: expect.any(String),
                },
                calendarDates: [],
            });
        });

        it("sets end date to 9 months from the current date if no operating period end date set", () => {
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
                    end_date: "20250101",
                    calendar_hash: expect.any(String),
                },
                calendarDates: [],
            });
        });
    });

    describe("mapVehicleJourneysToCalendars", () => {
        it("maps vehicle journeys without operating profile to service calendar if present", () => {
            const serviceCalendar = {
                calendar: {
                    ...defaultDaysOfOperation,
                    calendar_hash: "ServiceCalendarHash",
                },
                calendarDates: [],
            };

            const mappedVehicleJourneys = mapVehicleJourneysToCalendars(
                [
                    {
                        routeId: 1,
                        serviceId: 0,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test",
                    },
                    {
                        routeId: 2,
                        serviceId: 0,
                        shapeId: "2",
                        tripId: "2",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test2",
                    },
                ],
                serviceCalendar,
                defaultService.OperatingPeriod,
                bankHolidaysJson,
            );

            expect(mappedVehicleJourneys).toEqual([
                {
                    routeId: 1,
                    serviceId: 0,
                    shapeId: "1",
                    tripId: "1",
                    vehicleJourney: defaultVehicleJourney,
                    serviceCode: "test",
                    calendar: serviceCalendar,
                },
                {
                    routeId: 2,
                    serviceId: 0,
                    shapeId: "2",
                    tripId: "2",
                    vehicleJourney: defaultVehicleJourney,
                    serviceCode: "test2",
                    calendar: serviceCalendar,
                },
            ]);
        });

        it("maps vehicle journeys without operating profile to default calendar if no service calendar", () => {
            const expectedCalendar = {
                calendar: {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 1,
                    sunday: 1,
                    calendar_hash: "927fd813a3f84dcb748712795f691fb8188961ec1a3ecf6377e5de9bc6614840",
                    end_date: "20250101",
                },
                calendarDates: [],
            };

            const mappedVehicleJourneys = mapVehicleJourneysToCalendars(
                [
                    {
                        routeId: 1,
                        serviceId: 0,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test",
                    },
                ],
                null,
                defaultService.OperatingPeriod,
                bankHolidaysJson,
            );

            expect(mappedVehicleJourneys).toEqual([
                {
                    routeId: 1,
                    serviceId: 0,
                    shapeId: "1",
                    tripId: "1",
                    vehicleJourney: defaultVehicleJourney,
                    serviceCode: "test",
                    calendar: expectedCalendar,
                },
            ]);
        });

        it("maps vehicle journeys with an operating profile to a calendar for that profile", () => {
            const expectedCalendar = {
                calendar: {
                    ...defaultDaysOfOperation,
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    calendar_hash: "cc65c0de950f1d5daf75ad415278134aecedebcde3dd896596481f32ec4806e5",
                    end_date: "20250101",
                },
                calendarDates: [],
            };

            const vehicleJourney: VehicleJourney = {
                ...defaultVehicleJourney,
                OperatingProfile: {
                    RegularDayType: {
                        DaysOfWeek: {
                            MondayToFriday: "",
                        },
                    },
                },
            };

            const mappedVehicleJourneys = mapVehicleJourneysToCalendars(
                [
                    {
                        routeId: 1,
                        serviceId: 0,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney,
                        serviceCode: "test",
                    },
                ],
                null,
                defaultService.OperatingPeriod,
                bankHolidaysJson,
            );

            expect(mappedVehicleJourneys).toEqual([
                {
                    routeId: 1,
                    serviceId: 0,
                    shapeId: "1",
                    tripId: "1",
                    vehicleJourney,
                    serviceCode: "test",
                    calendar: expectedCalendar,
                },
            ]);
        });
    });

    describe("processCalendarDates", () => {
        const insertCalendarDatesSpy = vi.spyOn(database, "insertCalendarDates").mockResolvedValue();

        afterEach(() => {
            insertCalendarDatesSpy.mockClear();
        });

        it("inserts calendar dates for calendars with matching hashes", async () => {
            await processCalendarDates(
                dbClientMock,
                [
                    {
                        ...defaultDaysOfOperation,
                        calendar_hash: DEFAULT_HASH,
                        id: 2,
                    },
                    {
                        ...defaultDaysOfOperation,
                        calendar_hash: "NewHash",
                        id: 3,
                    },
                ],
                [
                    {
                        calendar: {
                            ...defaultDaysOfOperation,
                            calendar_hash: DEFAULT_HASH,
                        },
                        calendarDates: [
                            {
                                date: "20240401",
                                exception_type: 1,
                            },
                        ],
                    },
                    {
                        calendar: {
                            ...defaultDaysOfOperation,
                            calendar_hash: "NewHash",
                        },
                        calendarDates: [
                            {
                                date: "20240602",
                                exception_type: 2,
                            },
                        ],
                    },
                    {
                        calendar: {
                            ...defaultDaysOfOperation,
                            calendar_hash: "OtherHash",
                        },
                        calendarDates: [
                            {
                                date: "20240402",
                                exception_type: 2,
                            },
                        ],
                    },
                ],
            );

            expect(insertCalendarDatesSpy).toBeCalledWith(dbClientMock, [
                {
                    date: "20240401",
                    exception_type: 1,
                    service_id: 2,
                },
                {
                    date: "20240602",
                    exception_type: 2,
                    service_id: 3,
                },
            ]);
        });

        it("does not insert any calendar dates if no matching hashes", async () => {
            await processCalendarDates(
                dbClientMock,
                [
                    {
                        ...defaultDaysOfOperation,
                        calendar_hash: DEFAULT_HASH,
                        id: 2,
                    },
                ],
                [
                    {
                        calendar: {
                            ...defaultDaysOfOperation,
                            calendar_hash: "OTHER HASH",
                        },
                        calendarDates: [
                            {
                                date: "20240402",
                                exception_type: 2,
                            },
                        ],
                    },
                ],
            );

            expect(insertCalendarDatesSpy).not.toBeCalled();
        });
    });

    describe("processCalendars", () => {
        const insertCalendarSpy = vi.spyOn(database, "insertCalendars").mockResolvedValue([
            {
                ...defaultDaysOfOperation,
                calendar_hash: DEFAULT_HASH,
                id: 12,
            },
        ]);

        afterEach(() => {
            insertCalendarSpy.mockClear();
        });

        it("returns vehicle journey mapping with correct serviceId", async () => {
            const processedCalendars = await processCalendars(
                dbClientMock,
                defaultService,
                [
                    {
                        routeId: 1,
                        serviceId: 0,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test",
                    },
                    {
                        routeId: 2,
                        serviceId: 0,
                        shapeId: "2",
                        tripId: "2",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test2",
                    },
                ],
                bankHolidaysJson,
            );

            expect(processedCalendars).toEqual([
                {
                    routeId: 1,
                    serviceCode: "test",
                    serviceId: 12,
                    shapeId: "1",
                    tripId: "1",
                    vehicleJourney: defaultVehicleJourney,
                },
                {
                    routeId: 2,
                    serviceCode: "test2",
                    serviceId: 12,
                    shapeId: "2",
                    tripId: "2",
                    vehicleJourney: defaultVehicleJourney,
                },
            ]);
        });

        it("removes duplicate calendars", async () => {
            await processCalendars(
                dbClientMock,
                defaultService,
                [
                    {
                        routeId: 1,
                        serviceId: 0,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test",
                    },
                    {
                        routeId: 2,
                        serviceId: 0,
                        shapeId: "2",
                        tripId: "2",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test2",
                    },
                    {
                        routeId: 2,
                        serviceId: 0,
                        shapeId: "3",
                        tripId: "3",
                        vehicleJourney: {
                            ...defaultVehicleJourney,
                            OperatingProfile: {
                                ...defaultVehicleJourney,
                                RegularDayType: {
                                    DaysOfWeek: {
                                        Friday: "",
                                    },
                                },
                            },
                        },
                        serviceCode: "test2",
                    },
                ],
                bankHolidaysJson,
            );

            expect(insertCalendarSpy).toBeCalledWith(dbClientMock, [
                {
                    monday: 1,
                    tuesday: 1,
                    wednesday: 1,
                    thursday: 1,
                    friday: 1,
                    saturday: 1,
                    sunday: 1,
                    start_date: "20240401",
                    end_date: "20250101",
                    calendar_hash: DEFAULT_HASH,
                },
                {
                    ...defaultDaysOfOperation,
                    friday: 1,
                    end_date: "20250101",
                    calendar_hash: "fd96c7104362826f9df45c7d00bfe33b391e1954e36304127f96f056ddae198a",
                },
            ]);
        });

        it("removes trips with empty calendars", async () => {
            insertCalendarSpy.mockResolvedValue([
                {
                    ...defaultDaysOfOperation,
                    calendar_hash: DEFAULT_HASH,
                    id: 12,
                },
                {
                    ...defaultDaysOfOperation,
                    calendar_hash: "0388f4881e7cc8fbeb02f98d83a8a0f92e24a35458cc1c2b32f21729cd2142b5",
                    id: 13,
                },
            ]);

            const processedCalendars = await processCalendars(
                dbClientMock,
                defaultService,
                [
                    {
                        routeId: 1,
                        serviceId: 0,
                        shapeId: "1",
                        tripId: "1",
                        vehicleJourney: defaultVehicleJourney,
                        serviceCode: "test",
                    },
                    {
                        routeId: 2,
                        serviceId: 0,
                        shapeId: "2",
                        tripId: "2",
                        vehicleJourney: {
                            ...defaultVehicleJourney,
                            OperatingProfile: {
                                RegularDayType: {
                                    DaysOfWeek: {},
                                },
                            },
                        },
                        serviceCode: "test2",
                    },
                ],
                bankHolidaysJson,
            );

            expect(processedCalendars).toEqual([
                {
                    routeId: 1,
                    serviceCode: "test",
                    serviceId: 12,
                    shapeId: "1",
                    tripId: "1",
                    vehicleJourney: defaultVehicleJourney,
                },
            ]);
        });
    });

    describe("isCalendarEmpty", () => {
        it("returns true if calendar is empty", () => {
            const calendar = {
                ...defaultDaysOfOperation,
                start_date: "20240401",
                end_date: "20250101",
            };

            expect(
                isCalendarEmpty({
                    calendar,
                    calendarDates: [],
                }),
            ).toBe(true);
        });

        it("returns true if only calendar dates with exception type of 2", () => {
            const calendar = {
                ...defaultDaysOfOperation,
                start_date: "20240401",
                end_date: "20250101",
            };

            expect(
                isCalendarEmpty({
                    calendar,
                    calendarDates: [
                        {
                            date: "20240401",
                            exception_type: 2,
                        },
                        {
                            date: "20240402",
                            exception_type: 2,
                        },
                    ],
                }),
            ).toBe(true);
        });

        it("returns false if calendar is not empty", () => {
            const calendar = {
                ...defaultDaysOfOperation,
                start_date: "20240401",
                end_date: "20250101",
                monday: 1 as const,
            };

            expect(
                isCalendarEmpty({
                    calendar,
                    calendarDates: [
                        {
                            date: "20240401",
                            exception_type: 1,
                        },
                    ],
                }),
            ).toBe(false);
        });
    });
});
