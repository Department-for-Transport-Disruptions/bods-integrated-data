import MockDate from "mockdate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Avl } from "../database";
import * as s3 from "../s3";
import { GENERATED_SIRI_VM_FILE_PATH, GENERATED_SIRI_VM_TFL_FILE_PATH, generateSiriVmAndUploadToS3 } from "./utils";

const mockSiriVmResult = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <ServiceDelivery>
    <ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp>
    <ProducerRef>DepartmentForTransport</ProducerRef>
    <VehicleMonitoringDelivery>
      <ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp>
      <ValidUntil>2024-02-26T14:41:11.000Z</ValidUntil>
      <RequestMessageRef>acde070d-8c4c-4f0d-9d8a-162843c10333</RequestMessageRef>
      <VehicleActivity>
        <RecordedAtTime>2024-02-26T14:36:11.000Z</RecordedAtTime>
        <ValidUntilTime>2024-02-26T14:41:11.000Z</ValidUntilTime>
        <MonitoredVehicleJourney>
          <LineRef>784</LineRef>
          <DirectionRef>outbound</DirectionRef>
          <PublishedLineName>784</PublishedLineName>
          <Occupancy>full</Occupancy>
          <OperatorRef>NATX</OperatorRef>
          <OriginRef>98010</OriginRef>
          <OriginAimedDepartureTime>2024-02-26T14:36:18+00:00</OriginAimedDepartureTime>
          <DestinationRef>98045</DestinationRef>
          <VehicleLocation>
            <Longitude>-6.238029</Longitude>
            <Latitude>53.42605</Latitude>
          </VehicleLocation>
          <Bearing>119</Bearing>
          <BlockRef>784105</BlockRef>
          <VehicleRef>191D44717</VehicleRef>
        </MonitoredVehicleJourney>
      </VehicleActivity>
      <VehicleActivity>
        <RecordedAtTime>2024-02-26T14:36:11.000Z</RecordedAtTime>
        <ValidUntilTime>2024-02-26T14:41:11.000Z</ValidUntilTime>
        <VehicleMonitoringRef>test</VehicleMonitoringRef>
        <MonitoredVehicleJourney>
          <LineRef>ra</LineRef>
          <DirectionRef>outbound</DirectionRef>
          <PublishedLineName>ra</PublishedLineName>
          <Occupancy>full</Occupancy>
          <OperatorRef>TFLO</OperatorRef>
          <OriginRef>3390VB01</OriginRef>
          <OriginName>test origin name</OriginName>
          <OriginAimedDepartureTime>2024-02-26T14:36:18+00:00</OriginAimedDepartureTime>
          <DestinationRef>1090BSTN05</DestinationRef>
          <DestinationName>test destination name</DestinationName>
          <DestinationAimedArrivalTime>2024-02-26T14:36:18+00:00</DestinationAimedArrivalTime>
          <VehicleLocation>
            <Longitude>-1.471941</Longitude>
            <Latitude>52.92178</Latitude>
          </VehicleLocation>
          <BlockRef>DY04</BlockRef>
          <VehicleRef>0717_-_FJ58_KKL</VehicleRef>
          <VehicleJourneyRef>ref 123</VehicleJourneyRef>
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

const mockSiriVmTflResult = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <ServiceDelivery>
    <ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp>
    <ProducerRef>DepartmentForTransport</ProducerRef>
    <VehicleMonitoringDelivery>
      <ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp>
      <ValidUntil>2024-02-26T14:41:11.000Z</ValidUntil>
      <RequestMessageRef>acde070d-8c4c-4f0d-9d8a-162843c10333</RequestMessageRef>
      <VehicleActivity>
        <RecordedAtTime>2024-02-26T14:36:11.000Z</RecordedAtTime>
        <ValidUntilTime>2024-02-26T14:41:11.000Z</ValidUntilTime>
        <VehicleMonitoringRef>test</VehicleMonitoringRef>
        <MonitoredVehicleJourney>
          <LineRef>ra</LineRef>
          <DirectionRef>outbound</DirectionRef>
          <PublishedLineName>ra</PublishedLineName>
          <Occupancy>full</Occupancy>
          <OperatorRef>TFLO</OperatorRef>
          <OriginRef>3390VB01</OriginRef>
          <OriginName>test origin name</OriginName>
          <OriginAimedDepartureTime>2024-02-26T14:36:18+00:00</OriginAimedDepartureTime>
          <DestinationRef>1090BSTN05</DestinationRef>
          <DestinationName>test destination name</DestinationName>
          <DestinationAimedArrivalTime>2024-02-26T14:36:18+00:00</DestinationAimedArrivalTime>
          <VehicleLocation>
            <Longitude>-1.471941</Longitude>
            <Latitude>52.92178</Latitude>
          </VehicleLocation>
          <BlockRef>DY04</BlockRef>
          <VehicleRef>0717_-_FJ58_KKL</VehicleRef>
          <VehicleJourneyRef>ref 123</VehicleJourneyRef>
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

const mockAvl: Avl[] = [
    {
        id: 24173,
        response_time_stamp: "2024-02-26T14:37:04.665673+00:00",
        producer_ref: "DfT",
        recorded_at_time: "2024-02-26T14:36:18+00:00",
        valid_until_time: "2024-02-26 14:42:12",
        line_ref: "784",
        direction_ref: "OUT",
        operator_ref: "NATX",
        data_frame_ref: "",
        dated_vehicle_journey_ref: "784105",
        vehicle_ref: "191D44717",
        longitude: -6.238029,
        latitude: 53.42605,
        bearing: "119",
        published_line_name: "784",
        origin_ref: "98010",
        destination_ref: "98045",
        block_ref: "784105",
        occupancy: "full",
        origin_aimed_departure_time: "2024-02-26T14:36:18+00:00",
        geom: null,
        vehicle_name: null,
        monitored: null,
        load: null,
        passenger_count: null,
        odometer: null,
        headway_deviation: null,
        schedule_deviation: null,
        vehicle_state: null,
        next_stop_point_id: null,
        next_stop_point_name: null,
        previous_stop_point_id: null,
        previous_stop_point_name: null,
        origin_name: null,
        destination_name: null,
        vehicle_journey_ref: null,
        route_id: null,
        trip_id: null,
        vehicle_monitoring_ref: null,
        destination_aimed_arrival_time: null,
        ticket_machine_service_code: null,
        journey_code: null,
        vehicle_unique_id: null,
        has_onward_calls: false,
        subscription_id: "",
    },
    {
        id: 24183,
        response_time_stamp: "2024-02-26T14:37:04.665673+00:00",
        producer_ref: "ItoWorld",
        recorded_at_time: "2024-02-26T14:36:11+00:00",
        valid_until_time: "2024-02-26 14:42:12",
        line_ref: "ra",
        direction_ref: "outbound",
        operator_ref: "TFLO",
        data_frame_ref: "",
        dated_vehicle_journey_ref: "101405",
        vehicle_ref: "0717_-_FJ58_KKL",
        longitude: -1.471941,
        latitude: 52.92178,
        bearing: null,
        published_line_name: "ra",
        origin_ref: "3390VB01",
        destination_ref: "1090BSTN05",
        block_ref: "DY04",
        occupancy: "full",
        origin_aimed_departure_time: "2024-02-26T14:36:18+00:00",
        geom: null,
        vehicle_name: null,
        monitored: null,
        load: null,
        passenger_count: null,
        odometer: null,
        headway_deviation: null,
        schedule_deviation: null,
        vehicle_state: null,
        next_stop_point_id: null,
        next_stop_point_name: null,
        previous_stop_point_id: null,
        previous_stop_point_name: null,
        origin_name: "test origin name",
        destination_name: "test destination name",
        vehicle_journey_ref: "ref 123",
        vehicle_monitoring_ref: "test",
        destination_aimed_arrival_time: "2024-02-26T14:36:18+00:00",
        ticket_machine_service_code: "123",
        journey_code: "VJ_123",
        vehicle_unique_id: "Vehicle_123",
        has_onward_calls: true,
        route_id: null,
        trip_id: null,
        subscription_id: "",
    },
];

describe("utils", () => {
    describe("generateSiriVmAndUploadToS3", () => {
        vi.mock("../s3", () => ({
            putS3Object: vi.fn(),
        }));

        afterEach(() => {
            vi.resetAllMocks();
        });

        MockDate.set("2024-02-26T14:36:11+00:00");

        const requestMessageRef = "acde070d-8c4c-4f0d-9d8a-162843c10333";

        it("should convert valid avl data from the database into SIRI-VM and upload to S3", async () => {
            await generateSiriVmAndUploadToS3(mockAvl, requestMessageRef, "test-bucket");

            expect(s3.putS3Object).toHaveBeenCalledTimes(2);
            expect(s3.putS3Object).toHaveBeenNthCalledWith(1, {
                Bucket: "test-bucket",
                Key: GENERATED_SIRI_VM_FILE_PATH,
                ContentType: "application/xml",
                Body: mockSiriVmResult,
            });
            expect(s3.putS3Object).toHaveBeenNthCalledWith(2, {
                Bucket: "test-bucket",
                Key: GENERATED_SIRI_VM_TFL_FILE_PATH,
                ContentType: "application/xml",
                Body: mockSiriVmTflResult,
            });
        });
    });
});
