export const mockInput = {
    subscriptionId: "mock-subscription-id",
    subscription: {
        url: "https://mock-data-producer.com",
        description: "description",
        shortDescription: "shortDescription",
        publisherId: "mock-publisher-id",
        serviceStartDatetime: "2024-01-01T15:20:02.093Z",
        lastModifiedDateTime: "2024-01-01T15:20:02.093Z",
        apiKey: "mock-api-key",
    },
    tableName: "test-dynamo-table",
};

export const expectedRequestBody =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns:ns3="http://www.ifopt.org.uk/ifopt" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"><TerminateSubscriptionRequest><RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp><RequestorRef>BODS</RequestorRef><MessageIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</MessageIdentifier><SubscriptionRef>mock-subscription-id</SubscriptionRef></TerminateSubscriptionRequest></Siri>';

export const expectedSubscriptionRequestConfig = {
    headers: {
        "Content-Type": "text/xml",
        Authorization: "Basic dGVzdC1wYXNzd29yZDp0ZXN0LXBhc3N3b3Jk",
    },
};

export const mockSubscriptionResponseBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    <TerminateSubscriptionResponse>
        <TerminationResponseStatus>
            <ResponseTimestamp>2024-03-11T15:20:02.093Z</RequestTimeStamp>
            <SubscriptionRef>mock-subscription-id</SubscriptionRef>
            <Status>true</Status>
        </TerminationResponseStatus>
    </TerminateSubscriptionResponse>
</Siri>`;

export const mockSubscriptionInvalidBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    invalid
</Siri>`;

export const mockFailedSubscriptionResponseBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    <TerminateSubscriptionResponse>
        <TerminationResponseStatus>
            <ResponseTimestamp>2024-03-11T15:20:02.093Z</RequestTimeStamp>
            <SubscriptionRef>mock-subscription-id</SubscriptionRef>
            <Status>false</Status>
        </TerminationResponseStatus>
    </TerminateSubscriptionRequest>
</Siri>`;
