export const testSiri = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:13:20</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40261</Longitude>
                        <Latitude>63.43613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
            <VehicleActivity>
                <RecordedAtTime>2018-08-17T15:22:20</RecordedAtTime>
                <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2018-08-17</DataFrameRef>
                        <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                    </FramedVehicleJourneyRef>
                    <VehicleRef>200141</VehicleRef>
                    <Bearing>0</Bearing>
                    <VehicleLocation>
                        <Longitude>10.40361</Longitude>
                        <Latitude>63.42613</Latitude>
                    </VehicleLocation>
                    <BlockRef>blockRef</BlockRef>
                    <OriginRef>originRef</OriginRef>
                    <DestinationRef>destinationRef</DestinationRef>
                    <PublishedLineName>1</PublishedLineName>
                </MonitoredVehicleJourney>
            </VehicleActivity>
        </VehicleMonitoringDelivery>
    </ServiceDelivery>
</Siri>`;

export const eventtest = {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/path/to/resource",
    rawQueryString: "parameter1=value1&parameter1=value2&parameter2=value",
    cookies: ["cookie1", "cookie2"],
    headers: {
        Header1: "value1",
        Header2: "value1,value2",
    },
    queryStringParameters: {
        parameter1: "value1,value2",
        parameter2: "value",
    },
    requestContext: {
        accountId: "123456789012",
        apiId: "api-id",
        authentication: {
            clientCert: {
                clientCertPem: "CERT_CONTENT",
                subjectDN: "www.example.com",
                issuerDN: "Example issuer",
                serialNumber: "a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1",
                validity: {
                    notBefore: "May 28 12:30:02 2019 GMT",
                    notAfter: "Aug  5 09:36:04 2021 GMT",
                },
            },
        },
        authorizer: {
            jwt: {
                claims: {
                    claim1: "value1",
                    claim2: "value2",
                },
                scopes: ["scope1", "scope2"],
            },
        },
        domainName: "id.execute-api.us-east-1.amazonaws.com",
        domainPrefix: "id",
        http: {
            method: "POST",
            path: "/path/to/resource",
            protocol: "HTTP/1.1",
            sourceIp: "192.168.0.1/32",
            userAgent: "agent",
        },
        requestId: "id",
        routeKey: "$default",
        stage: "$default",
        time: "12/Mar/2020:19:03:58 +0000",
        timeEpoch: 1583348638390,
    },
    body: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Siri xmlns="http://www.siri.org.uk/siri"
        xmlns:ns2="http://www.ifopt.org.uk/acsb"
        xmlns:ns3="http://www.ifopt.org.uk/ifopt"
        xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
        version="2.0">
        <ServiceDelivery>
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <ProducerRef>ATB</ProducerRef>
            <VehicleMonitoringDelivery version="2.0">
                <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
                <VehicleActivity>
                    <RecordedAtTime>2018-08-17T15:13:20</RecordedAtTime>
                    <ValidUntilTime>2018-08-17T16:13:29</ValidUntilTime>
                    <MonitoredVehicleJourney>
                        <LineRef>ATB:Line:60</LineRef>
                        <DirectionRef>2</DirectionRef>
                        <OperatorRef>placeholder</OperatorRef>
                        <FramedVehicleJourneyRef>
                            <DataFrameRef>2018-08-17</DataFrameRef>
                            <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                        </FramedVehicleJourneyRef>
                        <VehicleRef>200141</VehicleRef>
                        <Bearing>0</Bearing>
                        <VehicleLocation>
                            <Longitude>10.40261</Longitude>
                            <Latitude>63.43613</Latitude>
                        </VehicleLocation>
                        <BlockRef>blockRef</BlockRef>
                        <OriginRef>originRef</OriginRef>
                        <DestinationRef>destinationRef</DestinationRef>
                        <PublishedLineName>1</PublishedLineName>
                    </MonitoredVehicleJourney>
                </VehicleActivity>
                <VehicleActivity>
                    <RecordedAtTime>2018-08-17T15:22:20</RecordedAtTime>
                    <ValidUntilTime>2018-08-17T16:22:29</ValidUntilTime>
                    <MonitoredVehicleJourney>
                        <LineRef>ATB:Line:60</LineRef>
                        <DirectionRef>2</DirectionRef>
                        <OperatorRef>placeholder</OperatorRef>
                        <FramedVehicleJourneyRef>
                            <DataFrameRef>2018-08-17</DataFrameRef>
                            <DatedVehicleJourneyRef>ATB:ServiceJourney:00600027</DatedVehicleJourneyRef>
                        </FramedVehicleJourneyRef>
                        <VehicleRef>200141</VehicleRef>
                        <Bearing>0</Bearing>
                        <VehicleLocation>
                            <Longitude>10.40361</Longitude>
                            <Latitude>63.42613</Latitude>
                        </VehicleLocation>
                        <BlockRef>blockRef</BlockRef>
                        <OriginRef>originRef</OriginRef>
                        <DestinationRef>destinationRef</DestinationRef>
                        <PublishedLineName>1</PublishedLineName>
                    </MonitoredVehicleJourney>
                </VehicleActivity>
            </VehicleMonitoringDelivery>
        </ServiceDelivery>
    </Siri>`,
    pathParameters: {
        subscriptionId: "testsubscription",
    },
    isBase64Encoded: true,
    stageVariables: {
        stageVariable1: "value1",
        stageVariable2: "value2",
    },
};
