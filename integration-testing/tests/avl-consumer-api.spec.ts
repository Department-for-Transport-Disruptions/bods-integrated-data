import { AvlConsumerSubscription, AvlSubscription } from "@bods-integrated-data/shared/schema";
import { expect, test } from "@playwright/test";
import { cleardownTestSubscription, createTestSubscription, makeSubscriptionInactive } from "./utils";

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
    PK: "1234",
    url: "http://siri.ticketer.org.uk/api/vm",
    description: "Playwright test subscription",
    shortDescription: "Playwright test subscription",
    requestorRef: "BODS_MOCK_PRODUCER",
    publisherId: "PLAYWRIGHT",
    apiKey: "test",
    status: "live",
};

const testConsumerSubscription: AvlConsumerSubscription = {
    PK: "621352ba-7fd9-47ab-b86f-38858d652951",
    SK: "1",
    subscriptionId: "PLAYWRIGHT_CONSUMER",
    status: "live",
    url: "https://www.test.com",
    requestorRef: "BODS_MOCK_PRODUCER",
    heartbeatInterval: "PT30S",
    initialTerminationTime: "2034-03-11T15:20:02.093Z",
    requestTimestamp: "2024-10-03T13:03:04.520Z",
    heartbeatAttempts: 0,
    queryParams: { subscriptionId: ["1234"] },
    lastRetrievedAvlId: 0,
    queueUrl: "",
    eventSourceMappingUuid: "",
    scheduleName: "",
};

const consumerSubscriptionId = "PLAYWRIGHT_CONSUMER";

test.beforeAll(async () => {
    await createTestSubscription(avlProducerSubscriptionTableName, testProducerSubscription);
    await makeSubscriptionInactive(avlConsumerSubscriptionTableName, testConsumerSubscription);
});

test.afterAll(async () => {
    await cleardownTestSubscription(avlProducerSubscriptionTableName, testProducerSubscription.PK);
    await makeSubscriptionInactive(avlConsumerSubscriptionTableName, testConsumerSubscription);
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

    test("should create a new avl consumer subscription when given valid inputs", async ({ request }) => {
        const subscriptionRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
            <Siri version=\"2.0\\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
              <SubscriptionRequest>
                <RequestTimestamp>${new Date().toISOString()}</RequestTimestamp>
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

        const subscribeResponse = await request.post(
            `${avlConsumerApiUrl(stage)}/siri-vm/subscribe?subscriptionId=${testProducerSubscription.PK}`,
            {
                data: subscriptionRequestBody,
                headers: { "x-user-id": "1", "Content-Type": "application/xml" },
            },
        );

        expect(subscribeResponse.status()).toBe(200);
    });

    test("should delete an avl consumer subscription when given valid inputs", async ({ request }) => {
        const terminateSubscriptionRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
            <Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\"
              xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"
              xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
              <TerminateSubscriptionRequest>
                <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
                <RequestorRef>BODS</RequestorRef>
                <MessageIdentifier>1</MessageIdentifier>
                <SubscriptionRef>${consumerSubscriptionId}</SubscriptionRef>
              </TerminateSubscriptionRequest>
            </Siri>
            `;

        /// A wait time is added here because the event source mapping created in the subscribe endpoint takes approx.
        // 12 seconds to create. Trying to hit the unsubscribe endpoint before this time will mean the event source mapping
        // is not deleted which makes future test runs fail
        await new Promise((res) => setTimeout(res, 15000));

        const unsubscribeResponse = await request.post(`${avlConsumerApiUrl(stage)}/siri-vm/unsubscribe`, {
            data: terminateSubscriptionRequestBody,
            headers: { "x-user-id": "1", "Content-Type": "application/xml" },
        });

        expect(unsubscribeResponse.status()).toBe(204);
    });
});
