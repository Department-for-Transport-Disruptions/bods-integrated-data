import {
    TflBlock,
    TflBlockCalendarDay,
    TflDestination,
    TflGarage,
    TflJourney,
    TflJourneyDriveTime,
    TflJourneyWaitTime,
    TflLine,
    TflOperator,
    TflPattern,
    TflRouteGeometry,
    TflStopInPattern,
    TflStopPoint,
    TflVehicle,
} from "@bods-integrated-data/shared/database";
import {
    TflBlockCalendarDaySchema,
    TflBlockSchema,
    TflDestinationSchema,
    TflGarageSchema,
    TflJourneyDriveTimeSchema,
    TflJourneySchema,
    TflJourneyWaitTimeSchema,
    TflLineSchema,
    TflOperatorSchema,
    TflPatternSchema,
    TflRouteGeometrySchema,
    TflStopInPatternSchema,
    TflStopPointSchema,
    TflVehicleSchema,
} from "@bods-integrated-data/shared/schema";
import { describe, expect, it } from "vitest";
import {
    mapTflBlockCalendarDays,
    mapTflBlocks,
    mapTflDestinations,
    mapTflGarages,
    mapTflJourneyDriveTimes,
    mapTflJourneys,
    mapTflJourneyWaitTimes,
    mapTflLines,
    mapTflOperators,
    mapTflPatterns,
    mapTflRouteGeometries,
    mapTflStopInPatterns,
    mapTflStopPoints,
    mapTflVehicles,
} from "./transformations";

describe("transformations", () => {
    describe("mapTflVehicles", () => {
        it("handles empty vehicle data", () => {
            const result = mapTflVehicles({ Vehicle: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL vehicle data to the TfL vehicle schema", () => {
            const vehicleData: TflVehicleSchema = {
                Vehicle: [
                    {
                        "@_aVehicleId": 123,
                        Registration_Number: "ABC123",
                        Bonnet_No: "456",
                        Operator_Agency: "XYZ",
                    },
                    {
                        "@_aVehicleId": 456,
                        Registration_Number: "DEF456",
                        Bonnet_No: "789",
                        Operator_Agency: "LMN",
                    },
                ],
            };

            const expected: TflVehicle[] = [
                {
                    id: 123,
                    registration_number: "ABC123",
                    bonnet_no: "456",
                    operator_agency: "XYZ",
                },
                {
                    id: 456,
                    registration_number: "DEF456",
                    bonnet_no: "789",
                    operator_agency: "LMN",
                },
            ];

            const result = mapTflVehicles(vehicleData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflOperators", () => {
        it("handles empty operator data", () => {
            const result = mapTflOperators({ Operator: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL operator data to the TfL operator schema", () => {
            const operatorData: TflOperatorSchema = {
                Operator: [
                    {
                        "@_aOperator_Code": "OP1",
                        Operator_Name: "Operator One",
                        Operator_Agency: "Agency1",
                    },
                    {
                        "@_aOperator_Code": "OP2",
                        Operator_Name: undefined,
                        Operator_Agency: "Agency2",
                    },
                ],
            };

            const expected: TflOperator[] = [
                {
                    id: "OP1",
                    operator_name: "Operator One",
                    operator_agency: "Agency1",
                },
                {
                    id: "OP2",
                    operator_name: null,
                    operator_agency: "Agency2",
                },
            ];

            const result = mapTflOperators(operatorData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflGarages", () => {
        it("handles empty garage data", () => {
            const result = mapTflGarages({ Garage: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL garage data to the TfL garage schema", () => {
            const garageData: TflGarageSchema = {
                Garage: [
                    {
                        "@_aGarage_No": 123,
                        "@_aOperator_Code": "OP1",
                        Garage_Code: "GC1",
                        Garage_Name: "Garage One",
                    },
                    {
                        "@_aGarage_No": 456,
                        "@_aOperator_Code": "OP2",
                        Garage_Code: "GC2",
                        Garage_Name: "Garage Two",
                    },
                ],
            };

            const expected: TflGarage[] = [
                {
                    id: 123,
                    operator_code: "OP1",
                    garage_code: "GC1",
                    garage_name: "Garage One",
                },
                {
                    id: 456,
                    operator_code: "OP2",
                    garage_code: "GC2",
                    garage_name: "Garage Two",
                },
            ];

            const result = mapTflGarages(garageData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflBlocks", () => {
        it("handles empty block data", () => {
            const result = mapTflBlocks({ Block: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL block data to the TfL block schema", () => {
            const blockData: TflBlockSchema = {
                Block: [
                    {
                        "@_aBlock_Idx": 123,
                        "@_aOperator_Code": "OP1",
                        Block_No: 12,
                        Running_No: 13,
                        Garage_No: 14,
                    },
                    {
                        "@_aBlock_Idx": 456,
                        "@_aOperator_Code": "OP2",
                        Block_No: 22,
                        Running_No: 33,
                        Garage_No: undefined,
                    },
                ],
            };

            const expected: TflBlock[] = [
                {
                    id: 123,
                    operator_code: "OP1",
                    block_no: 12,
                    running_no: 13,
                    garage_no: 14,
                },
                {
                    id: 456,
                    operator_code: "OP2",
                    block_no: 22,
                    running_no: 33,
                    garage_no: null,
                },
            ];

            const result = mapTflBlocks(blockData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflBlockCalendarDays", () => {
        it("handles empty block calendar day data", () => {
            const result = mapTflBlockCalendarDays({ Block_CalendarDay: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL block calendar day data to the TfL block calendar day schema", () => {
            const blockCalendarDayData: TflBlockCalendarDaySchema = {
                Block_CalendarDay: [
                    {
                        "@_aBlock_Idx": 123,
                        "@_aCalendar_Day": "2023-01-01",
                        Block_Runs_On_Day: 1,
                    },
                    {
                        "@_aBlock_Idx": 456,
                        "@_aCalendar_Day": "2023-01-02",
                        Block_Runs_On_Day: 0,
                    },
                ],
            };

            const expected: TflBlockCalendarDay[] = [
                {
                    id: "2023-01-01-123",
                    block_id: 123,
                    calendar_day: "2023-01-01",
                    block_runs_on_day: 1,
                },
                {
                    id: "2023-01-02-456",
                    block_id: 456,
                    calendar_day: "2023-01-02",
                    block_runs_on_day: 0,
                },
            ];

            const result = mapTflBlockCalendarDays(blockCalendarDayData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflStopPoints", () => {
        it("handles empty stop point data", () => {
            const result = mapTflStopPoints({ Stop_Point: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL stop point data to the TfL stop point schema", () => {
            const stopPointData: TflStopPointSchema = {
                Stop_Point: [
                    {
                        "@_aStop_Point_Idx": 123,
                        Stop_Code_LBSL: "123",
                        Stop_Name: "Stop One",
                        Location_Easting: 12345,
                        Location_Northing: 67890,
                        Location_Longitude: -0.123,
                        Location_Latitude: 51.123,
                        Point_Letter: "A",
                        NaPTAN_Code: "NPT1",
                        SMS_Code: "SMS1",
                        Stop_Area: "Area1",
                        Borough_Code: "BC1",
                        Heading: 11,
                        Stop_Type: "Type1",
                        Street_Name: "Street One",
                        Post_Code: "PC1",
                        Towards: "Destination One",
                    },
                    {
                        "@_aStop_Point_Idx": 456,
                        Stop_Code_LBSL: undefined,
                        Stop_Name: "Stop Two",
                        Location_Easting: undefined,
                        Location_Northing: undefined,
                        Location_Longitude: -0.456,
                        Location_Latitude: 51.456,
                        Point_Letter: undefined,
                        NaPTAN_Code: undefined,
                        SMS_Code: undefined,
                        Stop_Area: "Area2",
                        Borough_Code: undefined,
                        Heading: undefined,
                        Stop_Type: "Type2",
                        Street_Name: undefined,
                        Post_Code: undefined,
                        Towards: "Destination Two",
                    },
                ],
            };

            const expected: TflStopPoint[] = [
                {
                    id: 123,
                    stop_code_lbsl: "123",
                    stop_name: "Stop One",
                    location_easting: 12345,
                    location_northing: 67890,
                    location_longitude: -0.123,
                    location_latitude: 51.123,
                    point_letter: "A",
                    naptan_code: "NPT1",
                    sms_code: "SMS1",
                    stop_area: "Area1",
                    borough_code: "BC1",
                    heading: 11,
                    stop_type: "Type1",
                    street_name: "Street One",
                    post_code: "PC1",
                    towards: "Destination One",
                },
                {
                    id: 456,
                    stop_code_lbsl: null,
                    stop_name: "Stop Two",
                    location_easting: null,
                    location_northing: null,
                    location_longitude: -0.456,
                    location_latitude: 51.456,
                    point_letter: null,
                    naptan_code: null,
                    sms_code: null,
                    stop_area: "Area2",
                    borough_code: null,
                    heading: null,
                    stop_type: "Type2",
                    street_name: null,
                    post_code: null,
                    towards: "Destination Two",
                },
            ];

            const result = mapTflStopPoints(stopPointData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflDestinations", () => {
        it("handles empty destination data", () => {
            const result = mapTflDestinations({ Destination: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL destination data to the TfL destination schema", () => {
            const destinationData: TflDestinationSchema = {
                Destination: [
                    {
                        "@_aDestination_Idx": 123,
                        Long_Destination_Name: "Long Destination One",
                        Short_Destination_Name: "Short One",
                    },
                    {
                        "@_aDestination_Idx": 456,
                        Long_Destination_Name: "Long Destination Two",
                        Short_Destination_Name: undefined,
                    },
                ],
            };

            const expected: TflDestination[] = [
                {
                    id: 123,
                    long_destination_name: "Long Destination One",
                    short_destination_name: "Short One",
                },
                {
                    id: 456,
                    long_destination_name: "Long Destination Two",
                    short_destination_name: null,
                },
            ];

            const result = mapTflDestinations(destinationData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflRouteGeometries", () => {
        it("handles empty route geometry data", () => {
            const result = mapTflRouteGeometries({ Route_Geometry: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL route geometry data to the TfL route geometry schema", () => {
            const routeGeometryData: TflRouteGeometrySchema = {
                Route_Geometry: [
                    {
                        "@_aContract_Line_No": "CL1",
                        "@_aLBSL_Run_No": 123,
                        "@_aSequence_No": 456,
                        Direction: 1,
                        Location_Easting: 12345,
                        Location_Northing: 67890,
                        Location_Longitude: -0.123,
                        Location_Latitude: 51.123,
                    },
                ],
            };

            const expected: TflRouteGeometry[] = [
                {
                    id: "CL1-123-456",
                    contract_line_no: "CL1",
                    lbsl_run_no: 123,
                    sequence_no: 456,
                    direction: 1,
                    location_easting: 12345,
                    location_northing: 67890,
                    location_longitude: -0.123,
                    location_latitude: 51.123,
                },
            ];

            const result = mapTflRouteGeometries(routeGeometryData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflLines", () => {
        it("handles empty line data", () => {
            const result = mapTflLines({ Line: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL line data to the TfL line schema", () => {
            const lineData: TflLineSchema = {
                Line: [
                    {
                        "@_aContract_Line_No": "CL1",
                        Service_Line_No: "SL1",
                        Logical_Line_No: 123,
                    },
                ],
            };

            const expected: TflLine[] = [
                {
                    id: "CL1",
                    service_line_no: "SL1",
                    logical_line_no: 123,
                },
            ];

            const result = mapTflLines(lineData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflPatterns", () => {
        it("handles empty pattern data", () => {
            const result = mapTflPatterns({ Pattern: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL pattern data to the TfL pattern schema", () => {
            const patternData: TflPatternSchema = {
                Pattern: [
                    {
                        "@_aPattern_Idx": 123,
                        "@_aContract_Line_No": "CL1",
                        Direction: 2,
                        Type: 3,
                    },
                ],
            };

            const expected: TflPattern[] = [
                {
                    id: 123,
                    contract_line_no: "CL1",
                    direction: 2,
                    type: 3,
                },
            ];

            const result = mapTflPatterns(patternData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflStopInPatterns", () => {
        it("handles empty stop in pattern data", () => {
            const result = mapTflStopInPatterns({ Stop_In_Pattern: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL stop in pattern data to the TfL stop in pattern schema", () => {
            const stopInPatternData: TflStopInPatternSchema = {
                Stop_In_Pattern: [
                    {
                        "@_aStop_In_Pattern_Idx": 123,
                        "@_aPattern_Idx": 234,
                        "@_aDestination_Idx": 345,
                        "@_aStop_Point_Idx": 456,
                        Sequence_No: 1,
                        Timing_Point_Code: "TPC1",
                    },
                    {
                        "@_aStop_In_Pattern_Idx": 567,
                        "@_aPattern_Idx": 678,
                        "@_aDestination_Idx": undefined,
                        "@_aStop_Point_Idx": 789,
                        Sequence_No: 2,
                        Timing_Point_Code: "TPC2",
                    },
                ],
            };

            const expected: TflStopInPattern[] = [
                {
                    id: 123,
                    pattern_id: 234,
                    destination_id: 345,
                    stop_point_id: 456,
                    sequence_no: 1,
                    timing_point_code: "TPC1",
                },
                {
                    id: 567,
                    pattern_id: 678,
                    destination_id: null,
                    stop_point_id: 789,
                    sequence_no: 2,
                    timing_point_code: "TPC2",
                },
            ];

            const result = mapTflStopInPatterns(stopInPatternData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflJourneys", () => {
        it("handles empty journey data", () => {
            const result = mapTflJourneys({ Journey: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL journey data to the TfL journey schema", () => {
            const journeyData: TflJourneySchema = {
                Journey: [
                    {
                        "@_aJourney_Idx": 123,
                        "@_aPattern_Idx": 234,
                        "@_aBlock_Idx": 345,
                        Trip_No_LBSL: 456,
                        Type: 4,
                        Start_Time: 123456,
                    },
                ],
            };

            const expected: TflJourney[] = [
                {
                    id: 123,
                    pattern_id: 234,
                    block_id: 345,
                    trip_no_lbsl: 456,
                    type: 4,
                    start_time: 123456,
                },
            ];

            const result = mapTflJourneys(journeyData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflJourneyWaitTimes", () => {
        it("handles empty journey wait time data", () => {
            const result = mapTflJourneyWaitTimes({ Journey_Wait_Time: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL journey wait time data to the TfL journey wait time schema", () => {
            const journeyWaitTimeData: TflJourneyWaitTimeSchema = {
                Journey_Wait_Time: [
                    {
                        "@_aJourney_Idx": 123,
                        "@_aStop_In_Pattern_Idx": 456,
                        Wait_Time: 5,
                    },
                ],
            };

            const expected: TflJourneyWaitTime[] = [
                {
                    id: "123-456",
                    journey_id: 123,
                    stop_in_pattern_id: 456,
                    wait_time: 5,
                },
            ];

            const result = mapTflJourneyWaitTimes(journeyWaitTimeData);
            expect(result).toEqual(expected);
        });
    });

    describe("mapTflJourneyDriveTimes", () => {
        it("handles empty journey drive time data", () => {
            const result = mapTflJourneyDriveTimes({ Journey_Drive_Time: undefined });
            expect(result).toEqual([]);
        });

        it("maps TfL journey drive time data to the TfL journey drive time schema", () => {
            const journeyDriveTimeData: TflJourneyDriveTimeSchema = {
                Journey_Drive_Time: [
                    {
                        "@_aJourney_Idx": 123,
                        "@_aStop_In_Pattern_From_Idx": 456,
                        "@_aStop_In_Pattern_To_Idx": 789,
                        Drive_Time: 10,
                    },
                ],
            };

            const expected: TflJourneyDriveTime[] = [
                {
                    id: "123-456-789",
                    journey_id: 123,
                    stop_in_pattern_from_id: 456,
                    stop_in_pattern_to_id: 789,
                    drive_time: 10,
                },
            ];

            const result = mapTflJourneyDriveTimes(journeyDriveTimeData);
            expect(result).toEqual(expected);
        });
    });
});
