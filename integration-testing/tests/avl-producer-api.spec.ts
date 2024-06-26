import { test, expect } from "@playwright/test";
import { deleteDynamoItem } from "../data/dynamo";

const { AVL_PRODUCER_API_BASE_URL: apiProducerBaseUrl } = process.env;

const avlApiUrl = "https://avl-producer.dev.integrated-data.dft-create-data.com";
const tableName = "integrated-data-avl-subscription-table-dev";

const testSubscription = {
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
    await deleteDynamoItem(tableName, {
        PK: testSubscription.subscriptionId,
        SK: "SUBSCRIPTION",
    });
};

test.describe("avl-producer-api", () => {
    test.beforeAll(async () => {
        await cleardownTestSubscription();
    });

    test.afterAll(async () => {
        await cleardownTestSubscription();
    });

    test("should allow a new data producer subscription to be created", async ({ request }) => {
        const newSubscription = await request.post(`${avlApiUrl}/subscriptions`, {
            data: testSubscription,
        });

        expect(newSubscription.status()).toBe(201);

        const getSubscriptionResponse = await request.get(
            `${avlApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "LIVE",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlApiUrl}/subscriptions/`);

        expect(listSubscriptionsResponse.status()).toBe(200);
    });

    // test("should allow an existing data producer subscription to be updated", async ({ request }) => {
    //     const updateSubscription = await request.put(`${avlApiUrl}/subscriptions/${testSubscription.subscriptionId}`, {
    //         data: { testSubscription, username: "newUsername", password: "newPassword" },
    //     });
    //
    //     expect(updateSubscription.status()).toBe(204);
    //
    //     const getSubscriptionResponse = await request.get(
    //         `${avlApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
    //     );
    //
    //     expect(getSubscriptionResponse.status()).toBe(200);
    //
    //     expect(await getSubscriptionResponse.json()).toEqual(
    //         expect.objectContaining({
    //             id: testSubscription.subscriptionId,
    //             publisherId: testSubscription.publisherId,
    //             status: "LIVE",
    //         }),
    //     );
    //
    //     const listSubscriptionsResponse = await request.get(`${avlApiUrl}/subscriptions/`);
    //
    //     expect(listSubscriptionsResponse.status()).toBe(200);
    //
    //     expect(await listSubscriptionsResponse.json()).toEqual(
    //         expect.objectContaining({
    //             id: testSubscription.subscriptionId,
    //             publisherId: testSubscription.publisherId,
    //             status: "LIVE",
    //         }),
    //     );
    // });

    test("should allow a data producer subscription to be deleted", async ({ request }) => {
        const deleteSubscription = await request.delete(
            `${avlApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
        );

        expect(deleteSubscription.status()).toBe(201);

        const getSubscriptionResponse = await request.get(
            `${avlApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
        );

        expect(getSubscriptionResponse.status()).toBe(404);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "INACTIVE",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlApiUrl}/subscriptions/`);

        expect(listSubscriptionsResponse.status()).toBe(200);
    });
});
