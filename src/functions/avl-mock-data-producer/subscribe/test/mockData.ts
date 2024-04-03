import { APIGatewayProxyEvent } from "aws-lambda";

export const mockSubscriptionRequest = {
    body: `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
                    <Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
                        <SubscriptionRequest>
                            <RequestTimeStamp>2024-03-11T15:20:02.093Z</RequestTimeStamp>
                            <Address>https://mock-data-producer.com/5965q7gh-5428-43e2-a75c-1782a48637d5</Address>
                            <RequestorRef>BODS</RequestorRef>
                            <MessageIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</MessageIdentifier>
                            <SubscriptionRequestContext>
                                <HeartbeatInterval>PT30M</HeartbeatInterval>
                            </SubscriptionRequestContext>
                            <VehicleMonitoringSubscriptionRequest>
                                <SubscriberRef>BODS</SubscriberRef>
                                <SubscriptionIdentifier>TESTING</SubscriptionIdentifier>
                                <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
                                <VehicleMonitoringRequest version='2.0'>
                                    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
                                </VehicleMonitoringRequest>
                            </VehicleMonitoringSubscriptionRequest>
                        </SubscriptionRequest>
                    </Siri>`,
} as unknown as APIGatewayProxyEvent;

export const expectedSubscriptionResponse = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    <SubscriptionResponse>
        <ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp>
        <ResponderRef>Mock AVL Producer</ResponderRef>
        <RequestMessageRef>5965q7gh-5428-43e2-a75c-1782a48637d5</RequestMessageRef>
        <ResponseStatus>
            <ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp>
            <RequestMessageRef>BODS</RequestMessageRef>
            <SubscriptionRef>TESTING</SubscriptionRef>
            <Status>true</Status>
        </ResponseStatus>
        <ServiceStartedTime>2024-02-26T14:36:11.000Z</ServiceStartedTime>
    </SubscriptionResponse>
</Siri>`;
