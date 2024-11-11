import { AvlSubscribeMessage } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { expect, test } from "@playwright/test";
import { generateMockHeartbeat } from "../data/mockHeartbeat";
import { generateMockSiriVm } from "../data/mockSiri";
import { deleteAvlProducerSubscription, getAvlProducerSubscription, getSecretByKey } from "../utils";

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

test.beforeAll(async () => {
    await deleteAvlProducerSubscription(avlSubscriptionTableName, testSubscription.subscriptionId);
    headers["x-api-key"] = await getSecretByKey("avl_producer_api_key");
});

test.afterAll(async () => {
    await deleteAvlProducerSubscription(avlSubscriptionTableName, testSubscription.subscriptionId);
});

test.describe("avl-producer-api", () => {
    test("creates a AVL producer subscription when given valid inputs", async ({ request }) => {
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

    test("updates an AVL producer subscription when given valid inputs", async ({ request }) => {
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

    test("posts AVL data to the data endpoint", async ({ request }) => {
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 3);
        const mockTimestamp = now.toISOString();
        const mockEndTimestamp = endDate.toISOString();

        const { apiKey } = await getAvlProducerSubscription(avlSubscriptionTableName, testSubscription.subscriptionId);
        const mockHeartbeat = generateMockHeartbeat(testSubscription.subscriptionId, mockTimestamp);
        const mockSiri = generateMockSiriVm(testSubscription.subscriptionId, mockTimestamp, mockEndTimestamp);

        const heartbeatRequest = await request.post(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}?apiKey=${apiKey}`,
            { headers: { ...headers, "Content-Type": "text/xml" }, data: mockHeartbeat },
        );

        expect(heartbeatRequest.status()).toBe(200);

        const dataRequest = await request.post(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}?apiKey=${apiKey}`,
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

    test("unsubscribes an AVL producer subscription when given valid inputs", async ({ request }) => {
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
