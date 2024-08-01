import { AvlSubscribeMessage } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { expect, test } from "@playwright/test";
import { deleteDynamoItem, getDynamoItem } from "../data/dynamo";
import { generateMockHeartbeat } from "../data/mockHeartbeat";
import { generateMockSiriVm } from "../data/mockSiri";
import { getSecretByKey } from "./utils";

const { STAGE: stage } = process.env;

if (!stage) {
    throw new Error("Missing env vars - STAGE must be set");
}

const avlProducerApiUrl = `https://avl-producer.${stage}.integrated-data.dft-create-data.com`;
const avlSubscriptionTableName = `integrated-data-avl-subscription-table-${stage}`;
const headers = {
    apiKey: "",
};

const testSubscription: AvlSubscribeMessage = {
    dataProducerEndpoint: "http://siri.ticketer.org.uk/api/vm",
    description: "Playwright test subscription",
    shortDescription: "Playwright test subscription",
    username: "PLAYWRIGHT",
    password: "PLAYWRIGHT",
    subscriptionId: "PLAYWRIGHT",
    requestorRef: "BODS_MOCK_PRODUCER",
    publisherId: "PLAYWRIGHT",
};

const cleardownTestSubscription = async () => {
    await deleteDynamoItem(avlSubscriptionTableName, {
        PK: testSubscription.subscriptionId,
        SK: "SUBSCRIPTION",
    });
};

const getTestSubscription = async () => {
    const dynamoItem = await getDynamoItem(avlSubscriptionTableName, {
        PK: testSubscription.subscriptionId,
        SK: "SUBSCRIPTION",
    });

    if (!dynamoItem) {
        throw new Error("Subscription not found in dynamo");
    }

    return dynamoItem;
};

test.beforeAll(async () => {
    await cleardownTestSubscription();
    headers["x-api-key"] = await getSecretByKey(stage, "avl_producer_api_key");
});

test.afterAll(async () => {
    await cleardownTestSubscription();
});

test.describe("avl-producer-api", () => {
    test("should allow a new data producer subscription to be created", async ({ request }) => {
        const newSubscription = await request.post(`${avlProducerApiUrl}/subscriptions`, {
            headers,
            data: testSubscription,
        });

        expect(newSubscription.status()).toBe(201);

        const getSubscriptionResponse = await request.get(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
            { headers },
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "live",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlProducerApiUrl}/subscriptions/`, { headers });

        expect(listSubscriptionsResponse.status()).toBe(200);

        expect(await listSubscriptionsResponse.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: testSubscription.subscriptionId,
                    publisherId: testSubscription.publisherId,
                    status: "live",
                }),
            ]),
        );
    });

    test("should allow an existing data producer subscription to be updated", async ({ request }) => {
        const updateSubscription = await request.put(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
            {
                headers,
                data: { ...testSubscription, username: "newUsername", password: "newPassword" },
            },
        );

        expect(updateSubscription.status()).toBe(204);

        const getSubscriptionResponse = await request.get(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
            { headers },
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "live",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlProducerApiUrl}/subscriptions/`, { headers });

        expect(listSubscriptionsResponse.status()).toBe(200);

        expect(await listSubscriptionsResponse.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: testSubscription.subscriptionId,
                    publisherId: testSubscription.publisherId,
                    status: "live",
                }),
            ]),
        );
    });

    test("should post data to data endpoint", async ({ request }) => {
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 3);
        const mockTimestamp = now.toISOString();
        const mockEndTimestamp = endDate.toISOString();

        const subscription = await getTestSubscription();
        const mockHeartbeat = generateMockHeartbeat(testSubscription.subscriptionId, mockTimestamp);
        const mockSiri = generateMockSiriVm(testSubscription.subscriptionId, mockTimestamp, mockEndTimestamp);

        const heartbeatRequest = await request.post(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}?apiKey=${subscription.apiKey}`,
            { headers: { ...headers, "Content-Type": "text/xml" }, data: mockHeartbeat },
        );

        expect(heartbeatRequest.status()).toBe(200);

        const dataRequest = await request.post(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}?apiKey=${subscription.apiKey}`,
            { headers: { ...headers, "Content-Type": "text/xml" }, data: mockSiri },
        );

        expect(dataRequest.status()).toBe(200);

        const getSubscriptionResponse = await request.get(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
            { headers },
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        const responseData = await getSubscriptionResponse.json();

        expect(responseData.lastAvlDataReceivedDateTime).not.toBeNull();
        expect(responseData.heartbeatLastReceivedDateTime).not.toBeNull();
    });

    test("should allow a data producer subscription to be deleted", async ({ request }) => {
        const deleteSubscription = await request.delete(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
            { headers },
        );

        expect(deleteSubscription.status()).toBe(204);

        const getSubscriptionResponse = await request.get(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
            { headers },
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "inactive",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlProducerApiUrl}/subscriptions/`, { headers });

        expect(listSubscriptionsResponse.status()).toBe(200);

        expect(await listSubscriptionsResponse.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: testSubscription.subscriptionId,
                    publisherId: testSubscription.publisherId,
                    status: "inactive",
                }),
            ]),
        );
    });
});
