import * as eventBridge from "@bods-integrated-data/shared/eventBridge";
import { APIGatewayProxyEvent } from "aws-lambda";
import MockDate from "mockdate";
import { describe, it, expect, afterEach, vi, beforeAll } from "vitest";
import { expectedSubscriptionResponse, mockSubscriptionRequest } from "./test/mockData";
import { handler } from "./index";

vi.mock("crypto", () => ({
    randomUUID: () => "5965q7gh-5428-43e2-a75c-1782a48637d5",
}));

describe("avl-mock-data-producer-subscribe", () => {
    beforeAll(() => {
        process.env.EVENT_BRIDGE_RULE_NAME = "mock-rule";
        process.env.EVENT_BRIDGE_TARGET_ARN = "mock-target-arn";
    });

    vi.mock("@bods-integrated-data/shared/eventBridge", () => ({
        putEventBridgeTarget: vi.fn(),
    }));

    MockDate.set("2024-02-26T14:36:11+00:00");

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("should throw an error if body from data consumer is not xml", async () => {
        const invalidXmlRequest = {
            body: "invalid xml",
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(invalidXmlRequest)).rejects.toThrowError();
        expect(eventBridge.putEventBridgeTarget).not.toBeCalled();
    });

    it("should throw an error if invalid SIRI subscription request from data consumer is received", async () => {
        const invalidSubscriptionRequest = {
            body: `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
                    <Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
                        <SubscriptionRequest>
                            <InvalidRequest/>
                        </SubscriptionRequest>
                    </Siri>`,
        } as unknown as APIGatewayProxyEvent;

        await expect(handler(invalidSubscriptionRequest)).rejects.toThrowError("Error parsing subscription request");
        expect(eventBridge.putEventBridgeTarget).not.toBeCalled();
    });

    it("should create an eventbridge lambda target and send a subscription response if valid subscription request is received", async () => {
        await expect(handler(mockSubscriptionRequest)).resolves.toEqual({
            statusCode: 200,
            ok: true,
            body: expectedSubscriptionResponse,
        });

        expect(eventBridge.putEventBridgeTarget).toBeCalled();
        expect(eventBridge.putEventBridgeTarget).toBeCalledWith("mock-rule", [
            {
                Arn: "mock-target-arn",
                Id: "avl-mock-producer-send-data-TESTING",
            },
        ]);
    });
});
