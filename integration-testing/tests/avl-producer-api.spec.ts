import { expect, test } from "@playwright/test";
import { deleteDynamoItem } from "../data/dynamo";

const { STAGE: stage } = process.env;

const avlProducerApiUrl = `https://avl-producer.${stage}.integrated-data.dft-create-data.com`;
const avlSubscriptionTableName = `integrated-data-avl-subscription-table-${stage}`;

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
    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
    console.log(avlSubscriptionTableName);
    await deleteDynamoItem(avlSubscriptionTableName, {
        PK: testSubscription.subscriptionId,
        SK: "SUBSCRIPTION",
    });
};

test.beforeAll(async () => {
    await cleardownTestSubscription();
});

test.afterAll(async () => {
    await cleardownTestSubscription();
});

test.describe("avl-producer-api", () => {
    test("should allow a new data producer subscription to be created", async ({ request }) => {
        const newSubscription = await request.post(`${avlProducerApiUrl}/subscriptions`, {
            data: testSubscription,
        });

        expect(newSubscription.status()).toBe(201);

        const getSubscriptionResponse = await request.get(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "LIVE",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlProducerApiUrl}/subscriptions/`);

        expect(listSubscriptionsResponse.status()).toBe(200);

        expect(await listSubscriptionsResponse.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: testSubscription.subscriptionId,
                    publisherId: testSubscription.publisherId,
                    status: "LIVE",
                }),
            ]),
        );
    });

    test("should allow an existing data producer subscription to be updated", async ({ request }) => {
        const updateSubscription = await request.put(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
            {
                data: { ...testSubscription, username: "newUsername", password: "newPassword" },
            },
        );

        expect(updateSubscription.status()).toBe(204);

        const getSubscriptionResponse = await request.get(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "LIVE",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlProducerApiUrl}/subscriptions/`);

        expect(listSubscriptionsResponse.status()).toBe(200);

        expect(await listSubscriptionsResponse.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: testSubscription.subscriptionId,
                    publisherId: testSubscription.publisherId,
                    status: "LIVE",
                }),
            ]),
        );
    });

    test("should allow a data producer subscription to be deleted", async ({ request }) => {
        const deleteSubscription = await request.delete(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
        );

        expect(deleteSubscription.status()).toBe(204);

        const getSubscriptionResponse = await request.get(
            `${avlProducerApiUrl}/subscriptions/${testSubscription.subscriptionId}`,
        );

        expect(getSubscriptionResponse.status()).toBe(200);

        expect(await getSubscriptionResponse.json()).toEqual(
            expect.objectContaining({
                id: testSubscription.subscriptionId,
                publisherId: testSubscription.publisherId,
                status: "INACTIVE",
            }),
        );

        const listSubscriptionsResponse = await request.get(`${avlProducerApiUrl}/subscriptions/`);

        expect(listSubscriptionsResponse.status()).toBe(200);

        expect(await listSubscriptionsResponse.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: testSubscription.subscriptionId,
                    publisherId: testSubscription.publisherId,
                    status: "INACTIVE",
                }),
            ]),
        );
    });
});
