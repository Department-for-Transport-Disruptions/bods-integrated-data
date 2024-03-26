import * as s3RequestPresigner from "@aws-sdk/s3-request-presigner";
import { HttpRequest } from "@smithy/protocol-http";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { handler } from ".";

describe("gtfs-downloader-endpoint", () => {
    const mockBucketName = "mock-bucket";
    const presignMock = vi.spyOn(s3RequestPresigner.S3RequestPresigner.prototype, "presign");

    beforeEach(() => {
        process.env.BUCKET_NAME = mockBucketName;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("returns a 500 when the BUCKET_NAME environment variable is missing", async () => {
        process.env.BUCKET_NAME = "";

        await expect(handler()).resolves.toEqual({
            statusCode: 500,
            body: "An internal error occurred.",
        });
    });

    it("returns a 500 when a presigned URL could not be generated", async () => {
        presignMock.mockRejectedValueOnce({});

        await expect(handler()).resolves.toEqual({
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        });
    });

    it("returns a 500 when a presigned URL is generated but has no query parameters", async () => {
        presignMock.mockResolvedValueOnce(
            new HttpRequest({
                query: undefined,
            }),
        );

        await expect(handler()).resolves.toEqual({
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        });
    });

    it.only("returns a presigned URL for downloading a gtfs.zip file", async () => {
        presignMock.mockResolvedValueOnce(
            new HttpRequest({
                query: {
                    hello: "world",
                },
            }),
        );

        await expect(handler()).resolves.toEqual({
            statusCode: 302,
            headers: {
                Location: `https://${mockBucketName}.s3.eu-west-2.amazonaws.com/gtfs.zip?hello=world`,
            },
        });
    });
});
