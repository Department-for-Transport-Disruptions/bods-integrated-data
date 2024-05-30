import { AGGREGATED_SIRI_VM_FILE_PATH } from "@bods-integrated-data/shared/avl/utils";
import { Avl } from "@bods-integrated-data/shared/database";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared/dates";
import * as s3 from "@bods-integrated-data/shared/s3";
import MockDate from "mockdate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSiriVmAndUploadToS3 } from "./index";
import { mockSiriResult } from "./test/mockSiri";

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
        vehicle_monitoring_ref: null,
        destination_aimed_arrival_time: null,
        ticket_machine_service_code: null,
        journey_code: null,
        vehicle_unique_id: null,
    },
    {
        id: 24183,
        response_time_stamp: "2024-02-26T14:37:04.665673+00:00",
        producer_ref: "ItoWorld",
        recorded_at_time: "2024-02-26T14:36:11+00:00",
        valid_until_time: "2024-02-26 14:42:12",
        line_ref: "ra",
        direction_ref: "outbound",
        operator_ref: "TBTN",
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
        origin_name: null,
        destination_name: null,
        vehicle_journey_ref: null,
        vehicle_monitoring_ref: "test",
        destination_aimed_arrival_time: null,
        ticket_machine_service_code: "123",
        journey_code: "VJ_123",
        vehicle_unique_id: "Vehicle_123",
    },
];

describe("generateSiriVmAndUploadToS3", () => {
    vi.mock("@bods-integrated-data/shared/s3", () => ({
        putS3Object: vi.fn(),
    }));

    afterEach(() => {
        vi.resetAllMocks();
    });

    MockDate.set("2024-02-26T14:36:11+00:00");

    const currentTime = getDate();
    const validUntilTime = addIntervalToDate(currentTime, 5, "minutes");
    const requestMessageRef = "acde070d-8c4c-4f0d-9d8a-162843c10333";

    it("should convert valid avl data from the database into SIRI-VM and upload to S3", async () => {
        await generateSiriVmAndUploadToS3(
            mockAvl,
            currentTime.toISOString(),
            validUntilTime.toISOString(),
            requestMessageRef,
            "test-bucket",
        );

        expect(s3.putS3Object).toBeCalled();
        expect(s3.putS3Object).toBeCalledWith({
            Bucket: "test-bucket",
            Key: AGGREGATED_SIRI_VM_FILE_PATH,
            ContentType: "application/xml",
            Body: mockSiriResult,
        });
    });
});
