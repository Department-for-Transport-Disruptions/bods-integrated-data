import { APIGatewayProxyEvent } from "aws-lambda";

export const mockSubscriptionRequest = {
    body: `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
                    <Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
                        <SubscriptionRequest>
                            <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
                            <ConsumerAddress>https://mock-data-producer.com/5965q7gh-5428-43e2-a75c-1782a48637d5</ConsumerAddress>
                            <RequestorRef>BODS</RequestorRef>
                            <MessageIdentifier>5965q7gh-5428-43e2-a75c-1782a48637d5</MessageIdentifier>
                            <SubscriptionContext>
                                <HeartbeatInterval>PT30S</HeartbeatInterval>
                            </SubscriptionContext>
                            <VehicleMonitoringSubscriptionRequest>
                                <SubscriptionIdentifier>TESTING</SubscriptionIdentifier>
                                <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
                                <VehicleMonitoringRequest version='2.0'>
                                    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
                                </VehicleMonitoringRequest>
                            </VehicleMonitoringSubscriptionRequest>
                        </SubscriptionRequest>
                    </Siri>`,
} as unknown as APIGatewayProxyEvent;

export const expectedSubscriptionResponse =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd"><SubscriptionResponse><ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp><ResponderRef>Mock AVL Producer</ResponderRef><RequestMessageRef>5965q7gh-5428-43e2-a75c-1782a48637d5</RequestMessageRef><ResponseStatus><ResponseTimestamp>2024-02-26T14:36:11.000Z</ResponseTimestamp><SubscriberRef>Mock subscriber</SubscriberRef><SubscriptionRef>TESTING</SubscriptionRef><Status>true</Status></ResponseStatus><ServiceStartedTime>2024-02-26T14:36:11.000Z</ServiceStartedTime></SubscriptionResponse></Siri>';
