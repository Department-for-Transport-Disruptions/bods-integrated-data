import * as s3 from "@bods-integrated-data/shared/s3";
import { APIGatewayEvent } from "aws-lambda";
// eslint-disable-next-line import/no-unresolved
import * as MockDate from "mockdate";
import { beforeAll, afterEach, afterAll, describe, expect, it, vi } from "vitest";
import { eventtest } from "./testSiriVm";
import { handler } from ".";

describe("AVL-data-endpoint", () => {
    beforeAll(() => {
        process.env.BUCKET_NAME = "test-bucket";
    });

    vi.mock("@bods-integrated-data/shared/s3", () => ({
        putS3Object: vi.fn(),
    }));

    MockDate.set("2024-03-11T15:20:02.093Z");

    afterEach(() => {
        vi.resetAllMocks();
    });

    afterAll(() => {
        MockDate.reset();
    });

    const mockSubscriptionId = eventtest?.pathParameters?.subscriptionId;
    it("Should add valid XML to S3", async () => {
        const mockEvent = {
            body: eventtest.body,

            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 200 });

        expect(s3.putS3Object).toBeCalled();
        expect(s3.putS3Object).toBeCalledWith({
            Body: `${eventtest.body}`,
            Bucket: "test-bucket",
            ContentType: "application/xml",
            Key: `${mockSubscriptionId}/2024-03-11T15:20:02.093Z`,
        });
    });

    it("Should throw an error if the body is empty", async () => {
        const mockEvent = {
            body: null,
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;
        await expect(handler(mockEvent)).rejects.toThrowError("No body sent with event");
        expect(s3.putS3Object).not.toBeCalled();
    });

    it("Should throw an error if invalid XML is parsed", async () => {
        const mockEvent = {
            body: "abc",
            pathParameters: {
                subscriptionId: mockSubscriptionId,
            },
        } as unknown as APIGatewayEvent;

        await expect(handler(mockEvent)).resolves.toEqual({ statusCode: 400 });
        expect(s3.putS3Object).not.toBeCalled();
    });
});
