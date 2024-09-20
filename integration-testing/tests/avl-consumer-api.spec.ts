import { expect, test } from "@playwright/test";
import { cleardownTestSubscription, createTestSubscription } from "./utils";
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
const avlProducerSubscriptionTableName = `integrated-data-avl-subscription-table-${stage}`;
const avlConsumerSubscriptionTableName = `integrated-data-avl-consumer-subscription-table-${stage}`;

const testProducerSubscription: AvlSubscription = {
    PK: "1",
    url: "http://siri.ticketer.org.uk/api/vm",
    description: "Playwright test subscription",
    shortDescription: "Playwright test subscription",
    requestorRef: "BODS_MOCK_PRODUCER",
    publisherId: "PLAYWRIGHT",
    apiKey: "test",
    status: "live",
};

const testConsumerSubscription: AvlSubscribeMessage = {
    dataProducerEndpoint: "http://siri.ticketer.org.uk/api/vm",
    description: "Playwright test subscription",
    shortDescription: "Playwright test subscription",
    username: "PLAYWRIGHT",
    password: "PLAYWRIGHT",
    subscriptionId: "PLAYWRIGHT",
    requestorRef: "BODS_MOCK_PRODUCER",
    publisherId: "PLAYWRIGHT",
};

test.beforeAll(async () => {
    await createTestSubscription(avlProducerSubscriptionTableName, testProducerSubscription);
    await cleardownTestSubscription(avlConsumerSubscriptionTableName, testConsumerSubscription.subscriptionId);
});

test.afterAll(async () => {
    await cleardownTestSubscription(avlProducerSubscriptionTableName, testProducerSubscription.PK);
    await cleardownTestSubscription(avlConsumerSubscriptionTableName, testConsumerSubscription.subscriptionId);
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

    test("should", async ({ request }) => {
        const consumerSubscriptionId = "PLAYWRIGHT_CONSUMER";
        const subscriptionRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
            <Siri version=\"2.0\\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
              <SubscriptionRequest>
                <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
                <ConsumerAddress>https://www.test.com/data</ConsumerAddress>
                <RequestorRef>test</RequestorRef>
                <MessageIdentifier>123</MessageIdentifier>
                <SubscriptionContext>
                  <HeartbeatInterval>PT30S</HeartbeatInterval>
                </SubscriptionContext>
                <VehicleMonitoringSubscriptionRequest>
                  <SubscriptionIdentifier>${consumerSubscriptionId}</SubscriptionIdentifier>
                  <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
                  <VehicleMonitoringRequest version=\"2.0\">
                    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
                    <VehicleMonitoringDetailLevel>normal</VehicleMonitoringDetailLevel>
                  </VehicleMonitoringRequest>
                </VehicleMonitoringSubscriptionRequest>
              </SubscriptionRequest>
            </Siri>
            `;

        const subscribeResponse = await request.post(`${avlConsumerApiUrl(stage)}/siri-vm/subscribe?subscriptionId=1`, {
            data: subscriptionRequestBody,
            headers: { userId: consumerSubscriptionId, "Content-Type": "application/xml" },
        });

        const res = subscribeResponse.statusText();

        console.log(res);
        expect(subscribeResponse.status()).toBe(200);
    });
});
