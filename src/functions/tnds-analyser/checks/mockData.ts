import { getDate } from "@bods-integrated-data/shared/dates";
import { Txc } from "@bods-integrated-data/shared/schema";

export const mockValidData: Txc = {
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
        ServicedOrganisations: {
            ServicedOrganisation: [
                {
                    OrganisationCode: "ORG1",
                    WorkingDays: {
                        DateRange: [[getDate("2023-01-01"), getDate("2023-12-31")]],
                    },
                    Holidays: {
                        DateRange: [[getDate("2023-12-25"), getDate("2023-12-26")]],
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
                                JourneyPatternSectionRefs: ["JPS1"],
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
            ],
        },
    },
};

export const mockInvalidData: Txc = {
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
        ServicedOrganisations: {
            ServicedOrganisation: [
                {
                    OrganisationCode: "ORG1",
                    WorkingDays: {
                        DateRange: [[getDate("2023-01-01"), getDate("2023-12-31")]],
                    },
                    Holidays: {
                        DateRange: [[getDate("2023-12-25"), getDate("2023-12-26")]],
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
                                JourneyPatternSectionRefs: ["JPS1"],
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
            ],
        },
    },
};
