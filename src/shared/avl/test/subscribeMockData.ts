export const mockInput = {
    subscriptionId: "mock-subscription-id",
    subscription: {
        url: "https://mock-data-producer.com",
        description: "description",
        shortDescription: "shortDescription",
        publisherId: "mock-publisher-id",
        apiKey: "mock-api-key",
    },
    username: "test-user",
    password: "dummy-password",
    tableName: "test-dynamo-table",
    dataEndpoint: "https://www.test.com/data",
};

export const mockSubscriptionResponseBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
    <SubscriptionResponse>
        <ResponseTimestamp>2024-03-04T08:42:05.072928+01:00</ResponseTimestamp>
        <ResponderRef>TEST</ResponderRef>
        <ResponseStatus>
            <ResponseTimestamp>2024-03-011T15:22:05.072928+01:00</ResponseTimestamp>
            <RequestMessageRef>TEST</RequestMessageRef>
            <SubscriberRef>800b3a06-6241-49fb-98cf-933508813159</SubscriberRef>
            <SubscriptionRef>5965q7gh-5428-43e2-a75c-1782a48637d5</SubscriptionRef>
            <Status>true</Status>
        </ResponseStatus>
    </SubscriptionResponse>
</Siri>`;

export const expectedRequestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <SubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <ConsumerAddress>https://www.test.com/data/mock-subscription-id?apiKey=mock-api-key</ConsumerAddress>
    <RequestorRef>BODS</RequestorRef>
    <MessageIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</MessageIdentifier>
    <SubscriptionContext>
      <HeartbeatInterval>PT30S</HeartbeatInterval>
    </SubscriptionContext>
    <VehicleMonitoringSubscriptionRequest>
      <SubscriptionIdentifier>mock-subscription-id</SubscriptionIdentifier>
      <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
      <VehicleMonitoringRequest version=\"2.0\">
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
      </VehicleMonitoringRequest>
    </VehicleMonitoringSubscriptionRequest>
  </SubscriptionRequest>
</Siri>
`;

export const expectedSubscriptionRequestConfig = {
    headers: {
        Authorization: "Basic dGVzdC11c2VyOmR1bW15LXBhc3N3b3Jk",
        "Content-Type": "text/xml",
    },
};

export const mockSubscriptionResponseBodyFalseStatus = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <SubscriptionResponse>
    <ResponseTimestamp>2024-03-04T08:42:05.072928+01:00</ResponseTimestamp>
    <ResponderRef>TEST</ResponderRef>
    <ResponseStatus>
      <ResponseTimestamp>2024-03-011T15:22:05.072928+01:00</ResponseTimestamp>
      <RequestMessageRef>TEST</RequestMessageRef>
      <SubscriberRef>800b3a06-6241-49fb-98cf-933508813159</SubscriberRef>
      <SubscriptionRef>5965q7gh-5428-43e2-a75c-1782a48637d5</SubscriptionRef>
      <Status>false</Status>
    </ResponseStatus>
  </SubscriptionResponse>
</Siri>`;

export const expectedRequestBodyForMockProducer = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <SubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <ConsumerAddress>https://www.test.com/data/mock-subscription-id?apiKey=mock-api-key</ConsumerAddress>
    <RequestorRef>BODS_MOCK_PRODUCER</RequestorRef>
    <MessageIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</MessageIdentifier>
    <SubscriptionContext>
      <HeartbeatInterval>PT30S</HeartbeatInterval>
    </SubscriptionContext>
    <VehicleMonitoringSubscriptionRequest>
      <SubscriptionIdentifier>mock-subscription-id</SubscriptionIdentifier>
      <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
      <VehicleMonitoringRequest version=\"2.0\">
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
      </VehicleMonitoringRequest>
    </VehicleMonitoringSubscriptionRequest>
  </SubscriptionRequest>
</Siri>
`;
