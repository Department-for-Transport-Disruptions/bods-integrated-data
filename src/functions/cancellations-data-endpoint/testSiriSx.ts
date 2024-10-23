export const testSiriSxWithSinglePtSituationElement = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns="http://www.siri.org.uk/siri"
      version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2024-07-05T14:59:19+00:00</ResponseTimestamp>
        <ProducerRef>TKTR01L</ProducerRef>
        <Status>true</Status>
        <MoreData>false</MoreData>
        <SituationExchangeDelivery version="2.0">
            <ResponseTimestamp>2024-07-05T14:59:19+00:00</ResponseTimestamp>
            <SubscriberRef>97755CE8-A6EB-4EA8-ABB4-96FE7AC51788</SubscriberRef>
            <SubscriptionRef>30429AC6-A904-4F23-80BF-1BCCBDE39285</SubscriptionRef>
            <Status>true</Status>
            <Situations>
                <PtSituationElement>
                    <CreationTime>2024-07-05T14:59:19.5756392</CreationTime>
                    <ParticipantRef>TKTR01L</ParticipantRef>
                    <SituationNumber>7980741</SituationNumber>
                    <Version>1</Version>
                    <Progress>open</Progress>
                    <ValidityPeriod>
                        <StartTime>2024-07-05T14:39:00Z</StartTime>
                        <EndTime>2024-07-05T15:01:00Z</EndTime>
                    </ValidityPeriod>
                    <MiscellaneousReason>unknown</MiscellaneousReason>
                    <Affects>
                        <VehicleJourneys>
                            <AffectedVehicleJourney>
                                <VehicleJourneyRef>1069</VehicleJourneyRef>
                                <DatedVehicleJourneyRef>1069</DatedVehicleJourneyRef>
                                <Operator>
                                    <OperatorRef>AKSS</OperatorRef>
                                </Operator>
                                <LineRef>175</LineRef>
                                <PublishedLineName>174</PublishedLineName>
                                <DirectionRef>Inbound</DirectionRef>
                                <OriginAimedDepartureTime>2024-07-05T14:39:00Z</OriginAimedDepartureTime>
                                <DestinationAimedArrivalTime>2024-07-05T15:01:00Z</DestinationAimedArrivalTime>
                            </AffectedVehicleJourney>
                        </VehicleJourneys>
                    </Affects>
                    <Consequences>
                        <Consequence>
                            <Condition>cancelled</Condition>
                        </Consequence>
                    </Consequences>
                </PtSituationElement>
            </Situations>
        </SituationExchangeDelivery>
    </ServiceDelivery>
</Siri>`;

export const testSiriSx = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns="http://www.siri.org.uk/siri"
      version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2024-07-05T14:59:19+00:00</ResponseTimestamp>
        <ProducerRef>TKTR01L</ProducerRef>
        <Status>true</Status>
        <MoreData>false</MoreData>
        <SituationExchangeDelivery version="2.0">
            <ResponseTimestamp>2024-07-05T14:59:19+00:00</ResponseTimestamp>
            <SubscriberRef>97755CE8-A6EB-4EA8-ABB4-96FE7AC51788</SubscriberRef>
            <SubscriptionRef>30429AC6-A904-4F23-80BF-1BCCBDE39285</SubscriptionRef>
            <Status>true</Status>
            <Situations>
                <PtSituationElement>
                    <CreationTime>2024-07-05T14:59:19.5756392</CreationTime>
                    <ParticipantRef>TKTR01L</ParticipantRef>
                    <SituationNumber>7980741</SituationNumber>
                    <Version>1</Version>
                    <Progress>open</Progress>
                    <ValidityPeriod>
                        <StartTime>2024-07-05T14:39:00Z</StartTime>
                        <EndTime>2024-07-05T15:01:00Z</EndTime>
                    </ValidityPeriod>
                    <MiscellaneousReason>unknown</MiscellaneousReason>
                    <Affects>
                        <VehicleJourneys>
                            <AffectedVehicleJourney>
                                <VehicleJourneyRef>1069</VehicleJourneyRef>
                                <DatedVehicleJourneyRef>1069</DatedVehicleJourneyRef>
                                <Operator>
                                    <OperatorRef>AKSS</OperatorRef>
                                </Operator>
                                <LineRef>175</LineRef>
                                <PublishedLineName>175</PublishedLineName>
                                <DirectionRef>Inbound</DirectionRef>
                                <OriginAimedDepartureTime>2024-07-05T14:39:00Z</OriginAimedDepartureTime>
                                <DestinationAimedArrivalTime>2024-07-05T15:01:00Z</DestinationAimedArrivalTime>
                            </AffectedVehicleJourney>
                        </VehicleJourneys>
                    </Affects>
                    <Consequences>
                        <Consequence>
                            <Condition>cancelled</Condition>
                        </Consequence>
                    </Consequences>
                </PtSituationElement>
                <PtSituationElement>
                    <CreationTime>2024-07-05T14:59:19.5756392</CreationTime>
                    <ParticipantRef>TKTR01L</ParticipantRef>
                    <SituationNumber>1273736</SituationNumber>
                    <Version>1</Version>
                    <Progress>open</Progress>
                    <ValidityPeriod>
                        <StartTime>2024-07-05T14:39:00Z</StartTime>
                        <EndTime>2024-07-05T15:01:00Z</EndTime>
                    </ValidityPeriod>
                    <MiscellaneousReason>unknown</MiscellaneousReason>
                    <Affects>
                        <VehicleJourneys>
                            <AffectedVehicleJourney>
                                <VehicleJourneyRef>1987</VehicleJourneyRef>
                                <DatedVehicleJourneyRef>1987</DatedVehicleJourneyRef>
                                <Operator>
                                    <OperatorRef>FMAN</OperatorRef>
                                </Operator>
                                <LineRef>123</LineRef>
                                <PublishedLineName>175</PublishedLineName>
                                <DirectionRef>Outbound</DirectionRef>
                                <OriginAimedDepartureTime>2024-07-05T15:39:00Z</OriginAimedDepartureTime>
                                <DestinationAimedArrivalTime>2024-07-05T16:01:00Z</DestinationAimedArrivalTime>
                            </AffectedVehicleJourney>
                        </VehicleJourneys>
                    </Affects>
                    <Consequences>
                        <Consequence>
                            <Condition>cancelled</Condition>
                        </Consequence>
                    </Consequences>
                </PtSituationElement>
            </Situations>
        </SituationExchangeDelivery>
    </ServiceDelivery>
</Siri>`;

export const mockHeartbeatNotification = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri" xmlns:ns2="http://www.ifopt.org.uk/acsb" xmlns:ns3="http://www.ifopt.org.uk/ifopt" xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0">
    <HeartbeatNotification>
        <RequestTimestamp>2024-04-15T13:25:00+01:00</RequestTimestamp>
        <ProducerRef>411e4495-4a57-4d2f-89d5-cf105441f321</ProducerRef>
        <Status>true</Status>
        <ServiceStartedTime>2019-11-23T13:25:00+01:00</ServiceStartedTime>
    </HeartbeatNotification>
</Siri>`;

export const mockEmptySiri = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

export const testSiriWithNoPtSituationElement = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <SituationExchangeDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <Situations>
            </Situations>
        </SituationExchangeDelivery>
    </ServiceDelivery>
</Siri>`;

export const testSiriWithEmptyPtSituationElement = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <SituationExchangeDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <Situations>
                <PtSituationElement></PtSituationElement>
            </Situations>
        </SituationExchangeDelivery>
    </ServiceDelivery>
</Siri>`;

export const testSiriWithSelfClosingPtSituationElement = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
        <ProducerRef>ATB</ProducerRef>
        <SituationExchangeDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <Situations>
                <PtSituationElement/>
            </Situations>
        </SituationExchangeDelivery>
    </ServiceDelivery>
</Siri>`;
