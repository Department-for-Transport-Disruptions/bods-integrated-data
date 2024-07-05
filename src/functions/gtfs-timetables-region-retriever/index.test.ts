import * as s3 from "@bods-integrated-data/shared/s3";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { handler } from "./index";

describe("gtfs-timetables-region-retriever", () => {
    beforeAll(() => {
        process.env.BUCKET_NAME = "test-bucket";
    });

    vi.mock("@bods-integrated-data/shared/s3", () => ({
        listS3Objects: vi.fn(),
    }));

    vi.mock("@bods-integrated-data/shared/cloudwatch", () => ({
        putMetricData: vi.fn(),
    }));

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("should return an empty array if no region gtfs files are found", async () => {
        vi.spyOn(s3, "listS3Objects").mockResolvedValue({
            Contents: undefined,
            $metadata: {
                attempts: 1,
                cfId: "test",
                extendedRequestId: "test",
                httpStatusCode: 200,
                requestId: "test",
                totalRetryDelay: 60,
            },
        });

        await expect(handler()).resolves.toEqual({
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: "[]",
        });
    });

    it("should return region information for gtfs files", async () => {
        vi.spyOn(s3, "listS3Objects").mockResolvedValue({
            Contents: [
                {
                    Key: "ea_gtfs.zip",
                    LastModified: new Date(),
                    ETag: '"d54b8d2d8837c53449ea7c9d5016e132-10"',
                    Size: 48250425,
                    StorageClass: "STANDARD",
                },
                {
                    Key: "l_gtfs.zip",
                    LastModified: new Date(),
                    ETag: '"ea14c28d9b166a5bca2eec361cc908d1-8"',
                    Size: 37773219,
                    StorageClass: "STANDARD",
                },
            ],
            $metadata: {
                attempts: 1,
                cfId: "test",
                extendedRequestId: "test",
                httpStatusCode: 200,
                requestId: "test",
                totalRetryDelay: 60,
            },
        });

        await expect(handler()).resolves.toEqual({
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([
                {
                    regionCode: "EA",
                    regionDisplayName: "East Anglia",
                    regionName: "east_anglia",
                },
                {
                    regionCode: "L",
                    regionDisplayName: "London",
                    regionName: "london",
                },
            ]),
        });
    });

    it("filters out invalid regions", async () => {
        vi.spyOn(s3, "listS3Objects").mockResolvedValue({
            Contents: [
                {
                    Key: "ea_gtfs.zip",
                    LastModified: new Date(),
                    ETag: '"d54b8d2d8837c53449ea7c9d5016e132-10"',
                    Size: 48250425,
                    StorageClass: "STANDARD",
                },
                {
                    Key: "invalid_gtfs.zip",
                    LastModified: new Date(),
                    ETag: '"ea14c28d9b166a5bca2eec361cc908d1-8"',
                    Size: 37773219,
                    StorageClass: "STANDARD",
                },
            ],
            $metadata: {
                attempts: 1,
                cfId: "test",
                extendedRequestId: "test",
                httpStatusCode: 200,
                requestId: "test",
                totalRetryDelay: 60,
            },
        });

        await expect(handler()).resolves.toEqual({
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([
                {
                    regionCode: "EA",
                    regionDisplayName: "East Anglia",
                    regionName: "east_anglia",
                },
            ]),
        });
    });
});
