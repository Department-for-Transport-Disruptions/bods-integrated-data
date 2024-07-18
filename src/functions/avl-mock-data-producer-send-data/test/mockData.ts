import { AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";

export const mockSubscriptionsFromDynamo: AvlSubscription[] = [
    {
        PK: "subscription-one",
        url: "https://www.mock-data-producer-one.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "LIVE",
        requestorRef: "BODS_MOCK_PRODUCER",
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        publisherId: "test-publisher-id-1",
        apiKey: "mock-api-key-1",
    },
    {
        PK: "subscription-two",
        url: "https://www.mock-data-producer-two.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "LIVE",
        requestorRef: "BODS_MOCK_PRODUCER",
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        publisherId: "test-publisher-id-2",
        apiKey: "mock-api-key-2",
    },
];

export const expectedAVLDataForSubscription = (subscriptionId: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>${subscriptionId}</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2024-03-11T15:20:02.093Z</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2024-03-11T15:20:02.093Z</RecordedAtTime>
                <ValidUntilTime>2024-03-11T15:25:02.093Z</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>Test Operator</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-04-04</DataFrameRef>
                        <DatedVehicleJourneyRef>${subscriptionId}:ServiceJourney:00600039</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>-1.5464885</Longitude>
                        <Latitude>53.7954833</Latitude>
                    </VehicleLocation>
                    <BlockRef>1234</BlockRef>
                    <OriginRef>Leeds</OriginRef>
                    <DestinationRef>Sheffield</DestinationRef>
                    <PublishedLineName>60</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2024-03-11T15:20:02.093Z</RecordedAtTime>
                <ValidUntilTime>2024-03-11T15:25:02.093Z</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:11</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>Dummy operator</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-04-04</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600039</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>123456</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>-0.1410151</Longitude>
                        <Latitude>50.8288519</Latitude>
                    </VehicleLocation>
                    <BlockRef>6502</BlockRef>
                    <OriginRef>London</OriginRef>
                    <DestinationRef>Brighton</DestinationRef>
                    <PublishedLineName>11</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>`;
