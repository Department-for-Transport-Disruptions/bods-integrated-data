import { AvlSubscribeMessage } from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { APIGatewayEvent } from "aws-lambda";

export const mockAvlSubscribeMessage: AvlSubscribeMessage = {
    dataProducerEndpoint: "https://mock-data-producer.com",
    description: "description",
    shortDescription: "shortDescription",
    username: "test-user",
    password: "dummy-password",
};

export const mockSubscribeEvent = {
    body: JSON.stringify(mockAvlSubscribeMessage),
} as unknown as APIGatewayEvent;

export const expectedRequestBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    <SubscriptionRequest>
        <RequestTimeStamp>2024-03-11T15:20:02.093Z</RequestTimeStamp>
        <Address>https://www.test.com/data/5965q7gh-5428-43e2-a75c-1782a48637d5</Address>
        <RequestorRef>BODS</RequestorRef>
        <MessageIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</MessageIdentifier>
        <SubscriptionRequestContext>
            <HeartbeatInterval>PT30M</HeartbeatInterval>
        </SubscriptionRequestContext>
        <VehicleMonitoringSubscriptionRequest>
            <SubscriberRef>BODS</SubscriberRef>
            <SubscriptionIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</SubscriptionIdentifier>
            <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
            <VehicleMonitoringRequest version='2.0'>
                <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
            </VehicleMonitoringRequest>
        </VehicleMonitoringSubscriptionRequest>
    </SubscriptionRequest>
</Siri>`;

export const expectedSubscriptionRequest = { body: expectedRequestBody, method: "POST" };

export const mockSubscriptionResponseBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns:ns3="http://www.ifopt.org.uk/ifopt" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0">
    <SubscriptionResponse>
        <ResponseTimestamp>2024-03-04T08:42:05.072928+01:00</ResponseTimestamp>
        <ResponderRef>TEST</ResponderRef>
        <RequestMessageRef>5965q7gh-5428-43e2-a75c-1782a48637d5</RequestMessageRef>
        <ResponseStatus>
            <ResponseTimestamp>2024-03-011T15:22:05.072928+01:00</ResponseTimestamp>
            <RequestMessageRef>TEST</RequestMessageRef>
            <SubscriptionRef>5965q7gh-5428-43e2-a75c-1782a48637d5</SubscriptionRef>
            <Status>true</Status>
        </ResponseStatus>
        <ServiceStartedTime>2024-03-011T15:22:05.072928+01:00</ServiceStartedTime>
    </SubscriptionResponse>
</Siri>`;
