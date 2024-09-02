import { NewAvl } from "@bods-integrated-data/shared/database";
import { expect } from "vitest";

export const mockSubscriptionId = "123";
export const mockItemId = "12a345b6-2be9-49bb-852f-21e5a2400ea6";
export const mockDefinedItemId = "12a345b6-2be9-49bb-852f-21e5a2400ea7";

export const testSiri = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:13:20</RecordedAtTime>
                <RequestMessageRef/>
                <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>full</Occupancy>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40261</Longitude>
                        <Latitude>63.43613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:13:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:22:20</RecordedAtTime>
                <ItemIdentifier>${mockDefinedItemId}</ItemIdentifier>
                <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
                <VehicleMonitoringRef>TEST</VehicleMonitoringRef>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>seatsAvailable</Occupancy>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200142</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40361</Longitude>
                        <Latitude>63.42613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <VehicleJourneyRef>10</VehicleJourneyRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginName>test origin</OriginName>
                    <OriginAimedDepartureTime>2018-08-17T15:22:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <DestinationName>Destination unknown</DestinationName>
                    <DestinationAimedArrivalTime>2018-08-17T15:22:20</DestinationAimedArrivalTime>
                    <PublishedLineName>1</PublishedLineName>
                    <Monitored>true</Monitored>
                </MonitoredVehicleJourney>
                <Extensions>
                    <VehicleJourney>
                        <Operational>
                            <TicketMachine>
                                <TicketMachineServiceCode>123</TicketMachineServiceCode>
                                <JourneyCode>VJ_123</JourneyCode>
                            </TicketMachine>
                        </Operational>
                        <VehicleUniqueId>Vehicle_123</VehicleUniqueId>
                    </VehicleJourney>
                </Extensions>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>
`;

export const testSiriWithDuplicates = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:13:20</RecordedAtTime>
                <RequestMessageRef/>
                <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>full</Occupancy>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40261</Longitude>
                        <Latitude>63.43613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:13:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:12:20</RecordedAtTime>
                <ItemIdentifier>${mockDefinedItemId}</ItemIdentifier>
                <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
                <VehicleMonitoringRef>TEST</VehicleMonitoringRef>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>seatsAvailable</Occupancy>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40361</Longitude>
                        <Latitude>63.42613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <VehicleJourneyRef>10</VehicleJourneyRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginName>test origin</OriginName>
                    <OriginAimedDepartureTime>2018-08-17T15:22:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <DestinationName>Destination unknown</DestinationName>
                    <DestinationAimedArrivalTime>2018-08-17T15:22:20</DestinationAimedArrivalTime>
                    <PublishedLineName>1</PublishedLineName>
                    <Monitored>true</Monitored>
                </MonitoredVehicleJourney>
                <Extensions>
                    <VehicleJourney>
                        <Operational>
                            <TicketMachine>
                                <TicketMachineServiceCode>123</TicketMachineServiceCode>
                                <JourneyCode>VJ_123</JourneyCode>
                            </TicketMachine>
                        </Operational>
                        <VehicleUniqueId>Vehicle_123</VehicleUniqueId>
                    </VehicleJourney>
                </Extensions>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>
`;

export const testSiriWithOnwardCalls = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:13:20</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>full</Occupancy>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40261</Longitude>
                        <Latitude>63.43613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:13:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:22:20</RecordedAtTime>
                <ItemIdentifier>${mockDefinedItemId}</ItemIdentifier>
                <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
                <VehicleMonitoringRef>TEST</VehicleMonitoringRef>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>seatsAvailable</Occupancy>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200142</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40361</Longitude>
                        <Latitude>63.42613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <VehicleJourneyRef>10</VehicleJourneyRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginName>test origin</OriginName>
                    <OriginAimedDepartureTime>2018-08-17T15:22:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <DestinationName>Destination unknown</DestinationName>
                    <DestinationAimedArrivalTime>2018-08-17T15:22:20</DestinationAimedArrivalTime>
                    <PublishedLineName>1</PublishedLineName>
                    <Monitored>true</Monitored>
                    <OnwardCalls>
                        <OnwardCall>
                            <StopPointRef>STOP123</StopPointRef>
                            <AimedArrivalTime>2024-05-09T09:30:00+00:00</AimedArrivalTime>
                            <ExpectedArrivalTime>2024-05-09T09:30:00+00:00</ExpectedArrivalTime>
                            <AimedDepartureTime>2024-05-09T09:30:00+00:00</AimedDepartureTime>
                            <ExpectedDepartureTime>2024-05-09T09:30:00+00:00</ExpectedDepartureTime>
                        </OnwardCall>
                        <OnwardCall>
                            <StopPointRef>STOP456</StopPointRef>
                            <AimedArrivalTime>2024-05-09T09:30:00+00:00</AimedArrivalTime>
                            <ExpectedArrivalTime>2024-05-09T09:30:00+00:00</ExpectedArrivalTime>
                            <AimedDepartureTime>2024-05-09T09:30:00+00:00</AimedDepartureTime>
                            <ExpectedDepartureTime>2024-05-09T09:30:00+00:00</ExpectedDepartureTime>
                        </OnwardCall>
                    </OnwardCalls>
                </MonitoredVehicleJourney>
                <Extensions>
                    <VehicleJourney>
                        <Operational>
                            <TicketMachine>
                                <TicketMachineServiceCode>123</TicketMachineServiceCode>
                                <JourneyCode>VJ_123</JourneyCode>
                            </TicketMachine>
                        </Operational>
                        <VehicleUniqueId>Vehicle_123</VehicleUniqueId>
                    </VehicleJourney>
                </Extensions>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>
`;

export const testSiriWithInvalidVehicleActivities = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:22:20</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <OperatorRef>123</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <DataSource>ATB</DataSource>
                    <VehicleLocation>
                        <Latitude>63.42613</Latitude>
                    </VehicleLocation>
                    <Delay>PT0S</Delay>
                    <IsCompleteStopSequence>false</IsCompleteStopSequence>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:22:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                    <Occupancy>wrong</Occupancy>
                    <DestinationName>invalid $ name</DestinationName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2099-08-17T15:13:20</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>full</Occupancy>
                    <OperatorRef>123</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40261</Longitude>
                        <Latitude>63.43613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:13:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2024-07-22T12:01:00.000Z</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>full</Occupancy>
                    <OperatorRef>123</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40261</Longitude>
                        <Latitude>63.43613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:13:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>
`;

export const testInvalidSiri = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
`;

export const testSiriWithSingleVehicleActivity = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:13:20</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <Occupancy>full</Occupancy>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40261</Longitude>
                        <Latitude>63.43613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:13:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>
`;

export const parsedSiri: NewAvl[] = [
    {
        response_time_stamp: "2018-08-17T15:14:21.432",
        producer_ref: "ATB",
        recorded_at_time: "2018-08-17T15:13:20",
        item_id: mockItemId,
        valid_until_time: "2018-08-17T16:13:29",
        line_ref: "ATB:Line:60",
        direction_ref: "2",
        occupancy: "full",
        operator_ref: "placeholder",
        data_frame_ref: "2018-08-17",
        dated_vehicle_journey_ref: "ATB:ServiceJourney:00600027",
        destination_aimed_arrival_time: null,
        destination_name: null,
        vehicle_ref: "200141",
        longitude: 10.40261,
        latitude: 63.43613,
        bearing: "0",
        published_line_name: "1",
        monitored: null,
        origin_ref: "originRef",
        origin_aimed_departure_time: "2018-08-17T15:13:20",
        destination_ref: "destinationRef",
        block_ref: "blockRef",
        geom: expect.anything() as unknown,
        subscription_id: mockSubscriptionId,
        journey_code: null,
        origin_name: null,
        ticket_machine_service_code: null,
        vehicle_journey_ref: null,
        vehicle_monitoring_ref: null,
        vehicle_unique_id: null,
        onward_calls: null,
    },
    {
        response_time_stamp: "2018-08-17T15:14:21.432",
        producer_ref: "ATB",
        recorded_at_time: "2018-08-17T15:22:20",
        item_id: mockDefinedItemId,
        valid_until_time: "2018-08-17T16:22:29",
        line_ref: "ATB:Line:60",
        direction_ref: "2",
        occupancy: "seatsAvailable",
        operator_ref: "placeholder",
        data_frame_ref: "2018-08-17",
        dated_vehicle_journey_ref: "ATB:ServiceJourney:00600027",
        vehicle_ref: "200142",
        longitude: 10.40361,
        latitude: 63.42613,
        bearing: "0",
        published_line_name: "1",
        monitored: "true",
        origin_ref: "originRef",
        origin_aimed_departure_time: "2018-08-17T15:22:20",
        destination_ref: "destinationRef",
        block_ref: "blockRef",
        geom: expect.anything() as unknown,
        subscription_id: mockSubscriptionId,
        destination_aimed_arrival_time: "2018-08-17T15:22:20",
        destination_name: "Destination unknown",
        journey_code: "VJ_123",
        origin_name: "test origin",
        ticket_machine_service_code: "123",
        vehicle_journey_ref: "10",
        vehicle_monitoring_ref: "TEST",
        vehicle_unique_id: "Vehicle_123",
        onward_calls: null,
    },
] as NewAvl[];

export const parsedSiriWithOnwardCalls: NewAvl[] = [
    {
        response_time_stamp: "2018-08-17T15:14:21.432",
        producer_ref: "ATB",
        recorded_at_time: "2018-08-17T15:13:20",
        item_id: mockItemId,
        valid_until_time: "2018-08-17T16:13:29",
        line_ref: "ATB:Line:60",
        direction_ref: "2",
        occupancy: "full",
        operator_ref: "placeholder",
        data_frame_ref: "2018-08-17",
        dated_vehicle_journey_ref: "ATB:ServiceJourney:00600027",
        destination_aimed_arrival_time: null,
        destination_name: null,
        vehicle_ref: "200141",
        longitude: 10.40261,
        latitude: 63.43613,
        bearing: "0",
        published_line_name: "1",
        monitored: null,
        origin_ref: "originRef",
        origin_aimed_departure_time: "2018-08-17T15:13:20",
        destination_ref: "destinationRef",
        block_ref: "blockRef",
        geom: expect.anything() as unknown,
        subscription_id: mockSubscriptionId,
        journey_code: null,
        origin_name: null,
        ticket_machine_service_code: null,
        vehicle_journey_ref: null,
        vehicle_monitoring_ref: null,
        vehicle_unique_id: null,
        onward_calls: null,
    },
    {
        response_time_stamp: "2018-08-17T15:14:21.432",
        producer_ref: "ATB",
        recorded_at_time: "2018-08-17T15:22:20",
        item_id: mockDefinedItemId,
        valid_until_time: "2018-08-17T16:22:29",
        line_ref: "ATB:Line:60",
        direction_ref: "2",
        occupancy: "seatsAvailable",
        operator_ref: "placeholder",
        data_frame_ref: "2018-08-17",
        dated_vehicle_journey_ref: "ATB:ServiceJourney:00600027",
        vehicle_ref: "200142",
        longitude: 10.40361,
        latitude: 63.42613,
        bearing: "0",
        published_line_name: "1",
        monitored: "true",
        origin_ref: "originRef",
        origin_aimed_departure_time: "2018-08-17T15:22:20",
        destination_ref: "destinationRef",
        block_ref: "blockRef",
        geom: expect.anything() as unknown,
        subscription_id: mockSubscriptionId,
        destination_aimed_arrival_time: "2018-08-17T15:22:20",
        destination_name: "Destination unknown",
        journey_code: "VJ_123",
        origin_name: "test origin",
        ticket_machine_service_code: "123",
        vehicle_journey_ref: "10",
        vehicle_monitoring_ref: "TEST",
        vehicle_unique_id: "Vehicle_123",
        onward_calls:
            '[{"stop_point_ref":"STOP123","aimed_arrival_time":"2024-05-09T09:30:00+00:00","expected_arrival_time":"2024-05-09T09:30:00+00:00","aimed_departure_time":"2024-05-09T09:30:00+00:00","expected_departure_time":"2024-05-09T09:30:00+00:00"},{"stop_point_ref":"STOP456","aimed_arrival_time":"2024-05-09T09:30:00+00:00","expected_arrival_time":"2024-05-09T09:30:00+00:00","aimed_departure_time":"2024-05-09T09:30:00+00:00","expected_departure_time":"2024-05-09T09:30:00+00:00"}]',
    },
] as NewAvl[];

export const expectedPutMetricDataCallForFilteredArrayParseError = {
    namespace: "custom/SiriVmVehicleActivitySchema",
    metricData: [
        {
            MetricName: "MakeFilteredArraySchemaParseError",
            Value: 1,
        },
    ],
    metricDimensions: [
        {
            Name: "SubscriptionId",
            Value: "123",
        },
    ],
};
