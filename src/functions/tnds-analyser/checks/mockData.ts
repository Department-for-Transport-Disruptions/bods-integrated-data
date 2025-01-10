import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { PartialDeep } from "type-fest";

export const mockValidData: PartialDeep<TxcSchema> = {
    TransXChange: {
        Operators: {
            Operator: [
                {
                    NationalOperatorCode: "NOC123",
                    OperatorCode: "OP123",
                    OperatorShortName: "Operator 123",
                    "@_id": "1",
                },
            ],
        },
        RouteSections: {
            RouteSection: [
                {
                    "@_id": "RS1",
                    RouteLink: [
                        {
                            Track: [
                                {
                                    Mapping: {
                                        Location: [
                                            {
                                                Latitude: 51.123,
                                                Longitude: -1.123,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        Routes: {
            Route: [
                {
                    "@_id": "R1",
                    RouteSectionRef: ["RS1"],
                },
            ],
        },
        JourneyPatternSections: {
            JourneyPatternSection: [
                {
                    "@_id": "JPS1",
                    JourneyPatternTimingLink: [
                        {
                            "@_id": "JPTL1",
                            From: {
                                Activity: "pickUp",
                                StopPointRef: "SP1",
                                TimingStatus: "PTP",
                                WaitTime: "00:02",
                            },
                            To: {
                                Activity: "pickUpAndSetDown",
                                StopPointRef: "SP2",
                                TimingStatus: "OTH",
                                WaitTime: "00:03",
                            },
                            RunTime: "PT0M0S",
                        },
                        {
                            "@_id": "JPTL1",
                            From: {
                                Activity: "pickUpAndSetDown",
                                StopPointRef: "SP2",
                                TimingStatus: "OTH",
                                WaitTime: "00:03",
                            },
                            To: {
                                Activity: "pickUpAndSetDown",
                                StopPointRef: "SP3",
                                TimingStatus: "OTH",
                                WaitTime: "00:03",
                            },
                            RunTime: "PT10M0S",
                        },
                    ],
                },
                {
                    "@_id": "JPS2",
                    JourneyPatternTimingLink: [
                        {
                            "@_id": "JPTL2",
                            From: {
                                Activity: "pickUpAndSetDown",
                                StopPointRef: "SP3",
                                TimingStatus: "OTH",
                                WaitTime: "00:03",
                            },
                            To: {
                                Activity: "setDown",
                                StopPointRef: "SP4",
                                TimingStatus: "PTP",
                                WaitTime: "00:02",
                            },
                            RunTime: "PT10M0S",
                        },
                    ],
                },
            ],
        },
        ServicedOrganisations: {
            ServicedOrganisation: [
                {
                    OrganisationCode: "ORG1",
                    WorkingDays: {
                        DateRange: [{ EndDate: "2023-01-01" }, { EndDate: "2023-12-31" }],
                    },
                    Holidays: {
                        DateRange: [{ EndDate: "2023-12-25" }, { EndDate: "2023-12-26" }],
                    },
                },
            ],
        },
        Services: {
            Service: [
                {
                    ServiceCode: "SVC1",
                    OperatingPeriod: {
                        StartDate: "2023-01-01",
                        EndDate: "2023-12-31",
                    },
                    Lines: {
                        Line: [
                            {
                                "@_id": "L1",
                                LineName: "Line 1",
                            },
                        ],
                    },
                    Mode: "bus",
                    RegisteredOperatorRef: "OP123",
                    StandardService: {
                        JourneyPattern: [
                            {
                                "@_id": "JP1",
                                DestinationDisplay: "Central Station",
                                RouteRef: "R1",
                                JourneyPatternSectionRefs: ["JPS1", "JPS2"],
                                Direction: "outbound",
                            },
                        ],
                    },
                },
            ],
        },
        VehicleJourneys: {
            VehicleJourney: [
                {
                    "@_RevisionNumber": "1",
                    VehicleJourneyCode: "VJ12345",
                    DepartureTime: "08:00:00",
                    DestinationDisplay: "Central Station",
                    Frequency: {
                        EndTime: "18:00",
                        Interval: {
                            ScheduledFrequency: "15",
                        },
                    },
                    Operational: {
                        Block: {
                            BlockNumber: "B123",
                        },
                        TicketMachine: {
                            TicketMachineServiceCode: "TM123",
                            JourneyCode: "JC123",
                        },
                        VehicleType: {
                            WheelchairAccessible: true,
                            VehicleEquipment: {
                                WheelchairEquipment: {
                                    NumberOfWheelchairAreas: 2,
                                },
                            },
                        },
                    },
                    ServiceRef: "SVC1",
                    LineRef: "L1",
                    JourneyPatternRef: "JP1",
                    VehicleJourneyRef: "VJR123",
                    VehicleJourneyTimingLink: [
                        {
                            "@_id": "VJTL123",
                            JourneyPatternTimingLinkRef: "JPTL1",
                            From: {
                                Activity: "pickUp",
                                StopPointRef: "SP1",
                                TimingStatus: "scheduled",
                                WaitTime: "00:02",
                            },
                            To: {
                                Activity: "dropOff",
                                StopPointRef: "SP2",
                                TimingStatus: "scheduled",
                                WaitTime: "00:03",
                            },
                            RunTime: "00:10",
                        },
                    ],
                },
            ],
        },
        StopPoints: {
            AnnotatedStopPointRef: [
                {
                    StopPointRef: "SP1",
                    CommonName: "Stop 1",
                    Location: {
                        Latitude: 51.123,
                        Longitude: -1.123,
                    },
                },
                {
                    StopPointRef: "SP2",
                    CommonName: "Stop 2",
                    Location: {
                        Latitude: 51.123,
                        Longitude: -1.123,
                    },
                },
                {
                    StopPointRef: "SP4",
                    CommonName: "Stop 4",
                    Location: {
                        Latitude: 51.123,
                        Longitude: -1.123,
                    },
                },
            ],
            StopPoint: [
                {
                    AtcoCode: "ATCO1",
                    Descriptor: {
                        CommonName: "Stop 1",
                    },
                    Place: {
                        Location: {
                            Latitude: 51.123,
                            Longitude: -1.123,
                        },
                    },
                },
                {
                    AtcoCode: "ATCO2",
                    Descriptor: {
                        CommonName: "Stop 2",
                    },
                    Place: {
                        Location: {
                            Latitude: 51.123,
                            Longitude: -1.123,
                        },
                    },
                },
            ],
        },
    },
} as unknown as PartialDeep<TxcSchema>;

export const mockInvalidData: PartialDeep<TxcSchema> = {
    TransXChange: {
        Operators: {
            Operator: [
                {
                    NationalOperatorCode: "NOC123",
                    OperatorCode: "OP123",
                    OperatorShortName: "Operator 123",
                    "@_id": "1",
                },
            ],
        },
        RouteSections: {
            RouteSection: [
                {
                    "@_id": "RS1",
                    RouteLink: [
                        {
                            Track: [
                                {
                                    Mapping: {
                                        Location: [
                                            {
                                                Latitude: 51.123,
                                                Longitude: -1.123,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        Routes: {
            Route: [
                {
                    "@_id": "R1",
                    RouteSectionRef: ["RS1"],
                },
            ],
        },
        JourneyPatternSections: {
            JourneyPatternSection: [
                {
                    "@_id": "JPS1",
                    JourneyPatternTimingLink: [
                        {
                            "@_id": "JPTL1",
                            From: {
                                Activity: "setDown",
                                StopPointRef: "SP1",
                                TimingStatus: "wrong",
                                WaitTime: "00:02",
                            },
                            To: {
                                Activity: "pickUpAndSetDown",
                                StopPointRef: "SP11",
                                TimingStatus: "wrong",
                                WaitTime: "00:03",
                            },
                            RunTime: "00:10",
                        },
                    ],
                },
                {
                    "@_id": "JPS2",
                    JourneyPatternTimingLink: [
                        {
                            "@_id": "JPTL2",
                            From: {
                                Activity: "pickUpAndSetDown",
                                StopPointRef: "SP3",
                                TimingStatus: "wrong",
                                WaitTime: "00:01",
                            },
                            To: {
                                Activity: "pickUp",
                                StopPointRef: "SP2",
                                TimingStatus: "wrong",
                                WaitTime: "00:02",
                            },
                            RunTime: "00:08",
                        },
                    ],
                },
            ],
        },
        ServicedOrganisations: {
            ServicedOrganisation: [
                {
                    OrganisationCode: "ORG1",
                    WorkingDays: {
                        DateRange: [{ EndDate: "2023-01-01" }, { EndDate: "2023-12-31" }],
                    },
                    Holidays: {
                        DateRange: [{ EndDate: "2023-12-25" }, { EndDate: "2023-12-26" }],
                    },
                },
            ],
        },
        Services: {
            Service: [
                {
                    ServiceCode: "SVC1",
                    OperatingPeriod: {
                        StartDate: "2023-01-01",
                        EndDate: "2023-12-31",
                    },
                    Lines: {
                        Line: [
                            {
                                "@_id": "L1",
                                LineName: "Line 1",
                            },
                        ],
                    },
                    Mode: "bus",
                    RegisteredOperatorRef: "OP123",
                    StandardService: {
                        JourneyPattern: [
                            {
                                "@_id": "JP1",
                                DestinationDisplay: "Central Station",
                                RouteRef: "R1",
                                JourneyPatternSectionRefs: ["JPS1", "JPS2"],
                                Direction: "outbound",
                            },
                        ],
                    },
                },
            ],
        },
        VehicleJourneys: {
            VehicleJourney: [
                {
                    "@_RevisionNumber": "1",
                    VehicleJourneyCode: "VJ12345",
                    DepartureTime: "08:00",
                    DestinationDisplay: "Central Station",
                    Frequency: {
                        EndTime: "18:00",
                        Interval: {
                            ScheduledFrequency: "15",
                        },
                    },
                    Operational: {
                        TicketMachine: {
                            TicketMachineServiceCode: "TM123",
                            JourneyCode: "JC123",
                        },
                        VehicleType: {
                            WheelchairAccessible: true,
                            VehicleEquipment: {
                                WheelchairEquipment: {
                                    NumberOfWheelchairAreas: 2,
                                },
                            },
                        },
                    },
                    ServiceRef: "SVC1",
                    LineRef: "L1",
                    JourneyPatternRef: "JP1",
                    VehicleJourneyRef: "VJR123",
                    VehicleJourneyTimingLink: [
                        {
                            "@_id": "VJTL123",
                            JourneyPatternTimingLinkRef: "JPTL1",
                            From: {
                                Activity: "pickUp",
                                StopPointRef: "SP1",
                                TimingStatus: "scheduled",
                                WaitTime: "00:02",
                            },
                            To: {
                                Activity: "dropOff",
                                StopPointRef: "SP2",
                                TimingStatus: "scheduled",
                                WaitTime: "00:03",
                            },
                            RunTime: "00:10",
                        },
                    ],
                },
            ],
        },
        StopPoints: {
            AnnotatedStopPointRef: [
                {
                    StopPointRef: "SP1",
                    CommonName: "Stop 1",
                    Location: {
                        Latitude: 51.123,
                        Longitude: -1.123,
                    },
                },
                {
                    StopPointRef: "SP2",
                    CommonName: "Stop 2",
                    Location: {
                        Latitude: 51.123,
                        Longitude: -1.123,
                    },
                },
            ],
            StopPoint: [
                {
                    AtcoCode: "ATCO1",
                    Descriptor: {
                        CommonName: "Stop 1",
                    },
                    Place: {
                        Location: {
                            Latitude: 51.123,
                            Longitude: -1.123,
                        },
                    },
                },
                {
                    AtcoCode: "ATCO2",
                    Descriptor: {
                        CommonName: "Stop 2",
                    },
                    Place: {
                        Location: {
                            Latitude: 51.123,
                            Longitude: -1.123,
                        },
                    },
                },
            ],
        },
    },
} as unknown as PartialDeep<TxcSchema>;
