export const mockSubscriptionsFromDynamo = [
    {
        PK: "subscription-one",
        url: "https://www.mock-data-producer-one.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "ACTIVE",
        requestorRef: "BODS_MOCK_PRODUCER",
    },
    {
        PK: "subscription-two",
        url: "https://www.mock-data-producer-two.com",
        description: "test-description",
        shortDescription: "test-short-description",
        status: "ACTIVE",
        requestorRef: "BODS_MOCK_PRODUCER",
    },
];

export const expectedHeartbeatNotification = (
    subscriptionId: string,
) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns:ns3="http://www.ifopt.org.uk/ifopt" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0">
    <HeartbeatNotification>
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
        <ProducerRef>${subscriptionId}</ProducerRef>
        <Status>true</Status>
        <ServiceStartedTime>2024-03-11T15:20:02.093Z</ServiceStartedTime>
    </HeartbeatNotification>
</Siri>`;
