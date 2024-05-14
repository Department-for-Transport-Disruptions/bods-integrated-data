import { expect } from "vitest";

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
                <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
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
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:22:20</OriginAimedDepartureTime>
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
                <RecordedAtTime>2018-08-17T15:22:20</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
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
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <OriginAimedDepartureTime>2018-08-17T15:22:20</OriginAimedDepartureTime>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>
`;

export const parsedSiri = [
    {
        response_time_stamp: "2018-08-17T15:14:21.432",
        producer_ref: "ATB",
        recorded_at_time: "2018-08-17T15:13:20",
        valid_until_time: "2018-08-17T16:13:29",
        line_ref: "ATB:Line:60",
        direction_ref: "2",
        occupancy: "full",
        operator_ref: "placeholder",
        data_frame_ref: "2018-08-17",
        dated_vehicle_journey_ref: "ATB:ServiceJourney:00600027",
        vehicle_ref: "200141",
        longitude: 10.40261,
        latitude: 63.43613,
        bearing: "0",
        published_line_name: "1",
        origin_ref: "originRef",
        origin_aimed_departure_time: "2018-08-17T15:13:20",
        destination_ref: "destinationRef",
        block_ref: "blockRef",
        geom: expect.anything() as unknown,
    },
    {
        response_time_stamp: "2018-08-17T15:14:21.432",
        producer_ref: "ATB",
        recorded_at_time: "2018-08-17T15:22:20",
        valid_until_time: "2018-08-17T16:22:29",
        line_ref: "ATB:Line:60",
        direction_ref: "2",
        occupancy: "seatsAvailable",
        operator_ref: "placeholder",
        data_frame_ref: "2018-08-17",
        dated_vehicle_journey_ref: "ATB:ServiceJourney:00600027",
        vehicle_ref: "200141",
        longitude: 10.40361,
        latitude: 63.42613,
        bearing: "0",
        published_line_name: "1",
        origin_ref: "originRef",
        origin_aimed_departure_time: "2018-08-17T15:22:20",
        destination_ref: "destinationRef",
        block_ref: "blockRef",
        geom: expect.anything() as unknown,
    },
];
