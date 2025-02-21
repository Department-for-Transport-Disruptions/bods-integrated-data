import { logger } from "@bods-integrated-data/shared/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mocks = vi.hoisted(() => {
        return {
            getS3Object: vi.fn(),
            execute: vi.fn(),
            destroy: vi.fn(),
            mockDbClient: {
                destroy: vi.fn(),
            },
        };
    });

    vi.mock("@bods-integrated-data/shared/s3", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/s3")>()),
        getS3Object: mocks.getS3Object,
    }));

    const mockBucketName = "mock-bucket";

    vi.mock("@bods-integrated-data/shared/logger", async (importOriginal) => ({
        ...(await importOriginal<typeof import("@bods-integrated-data/shared/logger")>()),
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }));

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        await expect(handler({})).rejects.toThrow("An unexpected error occurred");

        expect(logger.error).toHaveBeenCalledWith(
            expect.any(Error),
            "There was a problem with the GTFS-RT service alerts downloader endpoint",
        );
    });

    describe("downloading GTFS-RT", () => {
        it("retrieves file from s3", async () => {
            mocks.getS3Object.mockResolvedValueOnce({ Body: { transformToString: () => "123" } });

            await expect(handler({})).resolves.toBe("123");

            expect(mocks.getS3Object).toHaveBeenCalledWith({
                Bucket: mockBucketName,
                Key: "gtfs-rt-service-alerts.bin",
            });
            expect(logger.error).not.toHaveBeenCalled();
        });

        it("returns a 500 when error received from S3", async () => {
            mocks.getS3Object.mockRejectedValueOnce(new Error());

            await expect(handler({})).rejects.toThrow("An unexpected error occurred");

            expect(logger.error).toHaveBeenCalledWith(
                expect.any(Error),
                "There was a problem with the GTFS-RT service alerts downloader endpoint",
            );
        });
    });
});
