import { AvlSubscribeMessage, AvlSubscription } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayProxyEvent } from "aws-lambda";

export const mockAvlSubscribeMessage: AvlSubscribeMessage = {
    dataProducerEndpoint: "https://mock-data-producer.com",
    description: "description",
    shortDescription: "shortDescription",
    username: "test-user",
    password: "dummy-password",
    subscriptionId: "mock-subscription-id",
    publisherId: "mock-publisher-id",
};

export const mockAvlSubscriptionDetails: Omit<AvlSubscription, "PK" | "status"> = {
    url: mockAvlSubscribeMessage.dataProducerEndpoint,
    description: mockAvlSubscribeMessage.description,
    shortDescription: mockAvlSubscribeMessage.shortDescription,
    publisherId: mockAvlSubscribeMessage.publisherId,
    requestorRef: undefined,
};

export const mockSubscribeEvent = {
    body: JSON.stringify(mockAvlSubscribeMessage),
} as unknown as APIGatewayProxyEvent;
