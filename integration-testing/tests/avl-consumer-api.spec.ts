import { expect, test } from "@playwright/test";
import { cleardownTestSubscription, createTestSubscription, getSecretByKey } from "./utils";
import { AvlSubscribeMessage, AvlSubscription } from "@bods-integrated-data/shared/schema";

const { STAGE: stage } = process.env;

if (!stage) {
    throw new Error("Missing env vars - STAGE must be set");
}

const avlConsumerApiUrl = (stage: string) => {
    switch (stage) {
        case "dev":
            return "https://gx1l45x0e7.execute-api.eu-west-2.amazonaws.com/v1";
        case "test":
            return "https://ya6tiqlzae.execute-api.eu-west-2.amazonaws.com/v1";
        default:
            throw new Error("Integration test can only be run in the dev or test environments.");
    }
};
const avlSubscriptionTableName = `integrated-data-avl-subscription-table-${stage}`;

const testSubscription: AvlSubscription = {
    PK: "PLAYWRIGHT_MOCK_PRODUCER",
    url: "http://siri.ticketer.org.uk/api/vm",
    description: "Playwright test subscription",
    shortDescription: "Playwright test subscription",
    requestorRef: "BODS_MOCK_PRODUCER",
    publisherId: "PLAYWRIGHT",
    status: "live",
};

test.beforeAll(async () => {
    await createTestSubscription(avlSubscriptionTableName, testSubscription);
});

test.afterAll(async () => {
    await cleardownTestSubscription(avlSubscriptionTableName, testSubscription.PK);
});

test.describe("avl-consumer-api", () => {
    test("should return all siri-vm data if no query parameters are passed", async ({ request }) => {
        const siriVmResponse = await request.get(`${avlConsumerApiUrl(stage)}/siri-vm`);

        expect(siriVmResponse.status()).toBe(200);
    });

    test("should return all siri-vm data if valid query parameters are passed", async ({ request }) => {
        const queryParams =
            "subscriptionId=test&operatorRef=test&lineRef=test&vehicleRef=test&producerRef=test&originRef=test&destinationRef=test&boundingBox=1,2,3,4";
        const siriVmResponse = await request.get(`${avlConsumerApiUrl(stage)}/siri-vm?${queryParams}`);

        expect(siriVmResponse.status()).toBe(200);
    });
});
