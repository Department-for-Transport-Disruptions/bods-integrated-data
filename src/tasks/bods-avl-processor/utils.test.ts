import { NewBodsAvl } from "@bods-integrated-data/shared/database";
import { describe, expect, it, vi } from "vitest";
import { parseXml } from "./utils";

const testSiri = `
<Siri xmlns="http://www.siri.org.uk/siri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd" version="2.0">
  <ServiceDelivery>
    <ResponseTimestamp>2024-07-18T08:31:01.826908+00:00</ResponseTimestamp>
    <ProducerRef>123</ProducerRef>
    <VehicleMonitoringDelivery>
      <ResponseTimestamp>2024-07-18T08:31:01.826908+00:00</ResponseTimestamp>
      <RequestMessageRef>4026f53d-3548-4999-a6b6-2e6893175894</RequestMessageRef>
      <ValidUntil>2024-07-18T08:36:01.826908+00:00</ValidUntil>
      <ShortestPossibleCycle>PT5S</ShortestPossibleCycle>
      <VehicleActivity>
        <RecordedAtTime>2024-07-18T08:30:47+00:00</RecordedAtTime>
        <ItemIdentifier>446797f4-e9ca-4176-b6e2-78757a7ee441</ItemIdentifier>
        <ValidUntilTime>2024-07-18T08:36:01.835329</ValidUntilTime>
        <MonitoredVehicleJourney>
          <LineRef>174</LineRef>
          <DirectionRef>outbound</DirectionRef>
          <FramedVehicleJourneyRef>
            <DataFrameRef>2024-07-18</DataFrameRef>
            <DatedVehicleJourneyRef>0820</DatedVehicleJourneyRef>
          </FramedVehicleJourneyRef>
          <PublishedLineName>174</PublishedLineName>
          <OperatorRef>QWERTY</OperatorRef>
          <OriginRef>1100DEC11150</OriginRef>
          <OriginName>Railway_Station</OriginName>
          <DestinationRef>1190TOA10709</DestinationRef>
          <DestinationName>Torbay_Hospital_Main_Entrance</DestinationName>
          <VehicleLocation>
            <Longitude>-3.556955</Longitude>
            <Latitude>50.489206</Latitude>
          </VehicleLocation>
          <Bearing>253.0</Bearing>
          <BlockRef>174</BlockRef>
          <VehicleRef>AB123CD</VehicleRef>
        </MonitoredVehicleJourney>
        <Extensions>
          <VehicleJourney>
            <Operational>
              <TicketMachine>
                <TicketMachineServiceCode>174</TicketMachineServiceCode>
                <JourneyCode>0820</JourneyCode>
              </TicketMachine>
            </Operational>
            <VehicleUniqueId>331</VehicleUniqueId>
          </VehicleJourney>
        </Extensions>
      </VehicleActivity>
    </VehicleMonitoringDelivery>
  </ServiceDelivery>
</Siri>
`;

describe("utils", () => {
    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    describe("parseXml", () => {
        it("parses valid SIRI-VML XML", () => {
            const xml = testSiri;
            const expectedAvls: NewBodsAvl[] = [
                {
                    response_time_stamp: "2024-07-18T08:31:01.826908+00:00",
                    producer_ref: "123",
                    recorded_at_time: "2024-07-18T08:30:47+00:00",
                    valid_until_time: "2024-07-18T08:36:01.835329",
                    line_ref: "174",
                    direction_ref: "outbound",
                    occupancy: null,
                    operator_ref: "QWERTY",
                    data_frame_ref: "2024-07-18",
                    dated_vehicle_journey_ref: "0820",
                    vehicle_ref: "AB123CD",
                    longitude: -3.556955,
                    latitude: 50.489206,
                    bearing: "253",
                    published_line_name: "174",
                    origin_ref: "1100DEC11150",
                    origin_aimed_departure_time: null,
                    destination_ref: "1190TOA10709",
                    block_ref: "174",
                },
            ];

            const result = parseXml(xml);
            expect(result).toEqual(expectedAvls);
        });
    });
});
