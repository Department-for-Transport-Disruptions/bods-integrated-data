import { AvlValidateRequestSchema } from "@bods-integrated-data/shared/schema/avl-validate.schema";

export const mockAvlValidateRequest: AvlValidateRequestSchema = {
    url: "https://mock-data-producer.com",
    username: "test-user",
    password: "dummy-password",
};

export const expectedServiceDeliveryRequestConfig = {
    headers: {
        Authorization: "Basic dGVzdC11c2VyOmR1bW15LXBhc3N3b3Jk",
        "Content-Type": "text/xml",
    },
};

export const expectedServiceDeliveryRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <ServiceRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <RequestorRef>BODS</RequestorRef>
    <VehicleMonitoringRequest>
      <VehicleMonitoringRequest version=\"2.0\">
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
      </VehicleMonitoringRequest>
    </VehicleMonitoringRequest>
  </ServiceRequest>
</Siri>
`;

export const mockServiceDeliveryResponse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
    <ServiceDelivery>
        <ResponseTimestamp>2024-07-11T14:10:14+00:00</ResponseTimestamp>
        <ProducerRef>TKTR01L</ProducerRef>
        <Status>true</Status>
        <MoreData>false</MoreData>
        <VehicleMonitoringDelivery version="1.3">
            <ResponseTimestamp>2024-07-11T14:10:14+00:00</ResponseTimestamp>
            <Status>true</Status>
            <VehicleActivity>
                <RecordedAtTime>2024-07-11T14:09:53+00:00</RecordedAtTime>
                <ValidUntilTime>2024-07-11T14:09:53+00:00</ValidUntilTime>
                <VehicleMonitoringRef>DELA</VehicleMonitoringRef>
                <MonitoredVehicleJourney>
                    <LineRef>101</LineRef>
                    <DirectionRef>outbound</DirectionRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-07-11</DataFrameRef>
                        <DatedVehicleJourneyRef>1450</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <PublishedLineName>101</PublishedLineName>
                    <OperatorRef>DELA</OperatorRef>
                    <VehicleLocation>
                        <Longitude>-0.36906</Longitude>
                        <Latitude>52.756616</Latitude>
                    </VehicleLocation>
                    <Bearing>-1</Bearing>
                    <BlockRef>1445n01</BlockRef>
                    <VehicleRef>157</VehicleRef>
                    <OnwardCalls>
                        <OnwardCall />
                    </OnwardCalls>
                </MonitoredVehicleJourney>
                <Extensions>
                    <VehicleJourney>
                        <Operational>
                            <TicketMachine>
                                <TicketMachineServiceCode>101_2</TicketMachineServiceCode>
                                <JourneyCode>1500</JourneyCode>
                            </TicketMachine>
                        </Operational>
                        <VehicleUniqueId>157</VehicleUniqueId>
                    </VehicleJourney>
                </Extensions>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>`;

export const mockServiceDeliveryResponseFalse = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
        <ServiceDelivery>
        <ResponseTimestamp>2024-07-11T14:10:14+00:00</ResponseTimestamp>
        <ProducerRef>TKTR01L</ProducerRef>
        <Status>false</Status>
        <MoreData>false</MoreData>
        <VehicleMonitoringDelivery version="1.3">
            <ResponseTimestamp>2024-07-11T14:10:14+00:00</ResponseTimestamp>
            <Status>false</Status>
            <VehicleActivity>
                <RecordedAtTime>2024-07-11T14:09:53+00:00</RecordedAtTime>
                <ValidUntilTime>2024-07-11T14:09:53+00:00</ValidUntilTime>
                <VehicleMonitoringRef>DELA</VehicleMonitoringRef>
                <MonitoredVehicleJourney>
                    <LineRef>101</LineRef>
                    <DirectionRef>outbound</DirectionRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-07-11</DataFrameRef>
                        <DatedVehicleJourneyRef>1450</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <PublishedLineName>101</PublishedLineName>
                    <OperatorRef>DELA</OperatorRef>
                    <VehicleLocation>
                        <Longitude>-0.36906</Longitude>
                        <Latitude>52.756616</Latitude>
                    </VehicleLocation>
                    <Bearing>-1</Bearing>
                    <BlockRef>1445n01</BlockRef>
                    <VehicleRef>157</VehicleRef>
                    <OnwardCalls>
                        <OnwardCall />
                    </OnwardCalls>
                </MonitoredVehicleJourney>
                <Extensions>
                    <VehicleJourney>
                        <Operational>
                            <TicketMachine>
                                <TicketMachineServiceCode>101_2</TicketMachineServiceCode>
                                <JourneyCode>1500</JourneyCode>
                            </TicketMachine>
                        </Operational>
                        <VehicleUniqueId>157</VehicleUniqueId>
                    </VehicleJourney>
                </Extensions>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>`;
