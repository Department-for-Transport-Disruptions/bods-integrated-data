import * as s3 from "@bods-integrated-data/shared/s3";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { testSiri } from "./testSiriVm";
import { handler } from ".";
import { APIGatewayEvent } from "aws-lambda";

describe("AVL-data-endpoint", () => {
    beforeAll(() => {
        process.env.BUCKET_NAME = "test-bucket";
    });
    vi.mock("@bods-integrated-data/shared/s3", () => ({
        putS3Object: vi.fn(),
    }));
    afterEach(() => {
        vi.resetAllMocks();
    });
    it("Should add valid XML to S3", async () => {
        // const mockEvent = {
        //     body: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?> <SubscriptionRequest><VehicleMonitoringSubscriptionRequest><SubscriptionIdentifier>1234</SubscriptionIdentifier></VehicleMonitoringSubscriptionRequest></SubscriptionRequest>",
        // } as APIGatewayEvent
        // await handler(mockEvent)
        // expect(s3.putS3Object).toBeCalled();
    });
    it("Should throw an error if the body is empty", async () => {
        const mockEvent = {
            body: null
        } as APIGatewayEvent
        await expect(async () => await handler(mockEvent)).rejects.toThrowError(
            "No body sent with event",
        );
        expect(s3.putS3Object).not.toBeCalled();
    });
    it("Should throw an error if invalid XML is parsed", async () => {
        const mockEvent = {
            body: "invalid xml test"
        } as APIGatewayEvent
        await expect(async () => await handler(mockEvent)).rejects.toThrowError(
            "Not a valid XML",
        );
        expect(s3.putS3Object).not.toBeCalled();
    });
})