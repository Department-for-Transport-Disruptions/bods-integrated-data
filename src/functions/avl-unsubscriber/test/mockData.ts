import { APIGatewayEvent } from "aws-lambda";

export const mockUnsubscribeEvent = {
    pathParameters: {
        subscription_id: "mock-subscription-id",
    },
} as unknown as APIGatewayEvent;

export const expectedRequestBody =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns:ns3="http://www.ifopt.org.uk/ifopt" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"><TerminateSubscriptionRequest><RequestTimeStamp>2024-03-11T15:20:02.093Z</RequestTimeStamp><RequestorRef>BODS</RequestorRef><MessageIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</MessageIdentifier><SubscriptionRef>mock-subscription-id</SubscriptionRef></TerminateSubscriptionRequest></Siri>';

export const expectedSubscriptionRequest = { body: expectedRequestBody, method: "POST" };

export const mockSubscriptionResponseBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    <TerminateSubscriptionResponse>
        <TerminateSubscriptionResponseStatus>
            <ResponseTimeStamp>2024-03-11T15:20:02.093Z</RequestTimeStamp>
            <SubscriptionRef>mock-subscription-id</SubscriptionRef>
            <Status>true</Status>
        </TerminateSubscriptionResponseStatus>
    </TerminateSubscriptionRequest>
</Siri>`;

export const mockSubscriptionInvalidBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    invalid
</Siri>`;

export const mockFailedSubscriptionResponseBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    <TerminateSubscriptionResponse>
        <TerminateSubscriptionResponseStatus>
            <ResponseTimeStamp>2024-03-11T15:20:02.093Z</RequestTimeStamp>
            <SubscriptionRef>mock-subscription-id</SubscriptionRef>
            <Status>false</Status>
        </TerminateSubscriptionResponseStatus>
    </TerminateSubscriptionRequest>
</Siri>`;
