import { addIntervalToDate, getDate } from "@bods-integrated-data/shared";
import * as s3 from "@bods-integrated-data/shared/s3";
import MockDate from "mockdate";
import { describe, it, expect, afterEach, vi } from "vitest";
import { mockSiriResult } from "./test/mockSiri";
import { generateSiriVmAndUploadToS3 } from "./index";

const mockAvl = [
    {
        id: 24173,
        responseTimeStamp: "2024-02-26T14:37:04.665673+00:00",
        producerRef: "DfT",
        recordedAtTime: "2024-02-26T14:36:18+00:00",
        validUntilTime: "2024-02-26 14:42:12",
        lineRef: "784",
        directionRef: "OUT",
        operatorRef: "NATX",
        datedVehicleJourneyRef: "784105",
        vehicleRef: "191D44717",
        longitude: -6.238029,
        latitude: 53.42605,
        bearing: "119",
        publishedLineName: "784",
        originRef: "98010",
        destinationRef: "98045",
        blockRef: "784105",
    },
    {
        id: 24183,
        responseTimeStamp: "2024-02-26T14:37:04.665673+00:00",
        producerRef: "ItoWorld",
        recordedAtTime: "2024-02-26T14:36:11+00:00",
        validUntilTime: "2024-02-26 14:42:12",
        lineRef: "ra",
        directionRef: "outbound",
        operatorRef: "TBTN",
        datedVehicleJourneyRef: "101405",
        vehicleRef: "0717_-_FJ58_KKL",
        longitude: -1.471941,
        latitude: 52.92178,
        bearing: null,
        publishedLineName: "ra",
        originRef: "3390VB01",
        destinationRef: "1090BSTN05",
        blockRef: "DY04",
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
            Key: "SIRI-VM.xml",
            ContentType: "application/xml",
            Body: mockSiriResult,
        });
    });
});
