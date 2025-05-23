import { NewSituation } from "@bods-integrated-data/shared/database";
import {
    Condition,
    MiscellaneousReason,
    Progress,
    Severity,
    SourceType,
    StopPointType,
} from "@bods-integrated-data/shared/schema/siri-sx/enums";

export const mockSubscriptionId = "100";

export const testSiriSx = `<?xml version="1.0" encoding="utf-8"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd">
  <ServiceDelivery>
    <ResponseTimestamp>2024-10-09T12:00:00+00:00</ResponseTimestamp>
    <ProducerRef>ATB</ProducerRef>
    <Status>true</Status>
    <MoreData>false</MoreData>
    <SituationExchangeDelivery version="2.0">
      <ResponseTimestamp>2024-10-09T12:00:00+00:00</ResponseTimestamp>
      <SubscriberRef>555</SubscriberRef>
      <SubscriptionRef>556</SubscriptionRef>
      <Status>true</Status>
      <Situations>
        <PtSituationElement>
          <CreationTime>2024-10-09T11:45:00+00:00</CreationTime>
          <ParticipantRef>ATB</ParticipantRef>
          <SituationNumber>123</SituationNumber>
          <Version>2</Version>
          <Source>
            <SourceType>other</SourceType>
          </Source>
          <Progress>closed</Progress>
          <ValidityPeriod>
            <StartTime>2024-10-09T13:00:00+00:00</StartTime>
            <EndTime>2024-10-09T13:30:00+00:00</EndTime>
          </ValidityPeriod>
          <MiscellaneousReason>roadworks</MiscellaneousReason>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehicleJourneyRef>2</VehicleJourneyRef>
                <DatedVehicleJourneyRef>2</DatedVehicleJourneyRef>
                <Operator>
                  <OperatorRef>ABCD</OperatorRef>
                </Operator>
                <LineRef>1</LineRef>
                <PublishedLineName>1</PublishedLineName>
                <DirectionRef>Outbound</DirectionRef>
                <Origins>
                  <StopPointRef>01</StopPointRef>
                  <StopPointName>First</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Origins>
                <Destinations>
                  <StopPointRef>02</StopPointRef>
                  <StopPointName>Second</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Destinations>
                <Route />
                <Calls>
                  <Call>
                    <CallCondition>cancelled</CallCondition>
                  </Call>
                </Calls>
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
          <CreationTime>2024-10-09T11:45:00+00:00</CreationTime>
          <ParticipantRef>ATB</ParticipantRef>
          <SituationNumber>124</SituationNumber>
          <Source>
            <SourceType>Email</SourceType>
          </Source>
          <Progress>closed</Progress>
          <ValidityPeriod>
            <StartTime>2024-10-09T13:00:00+00:00</StartTime>
          </ValidityPeriod>
          <MiscellaneousReason>roadworks</MiscellaneousReason>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehicleJourneyRef>3</VehicleJourneyRef>
                <DatedVehicleJourneyRef>3</DatedVehicleJourneyRef>
                <Operator>
                  <OperatorRef>ABCD</OperatorRef>
                </Operator>
                <LineRef>1</LineRef>
                <PublishedLineName>1</PublishedLineName>
                <DirectionRef>Outbound</DirectionRef>
                <Origins>
                  <StopPointRef>01</StopPointRef>
                  <StopPointName>First</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Origins>
                <Destinations>
                  <StopPointRef>02</StopPointRef>
                  <StopPointName>Second</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Destinations>
                <Route />
                <Calls>
                  <Call>
                    <CallCondition>normalService</CallCondition>
                  </Call>
                </Calls>
              </AffectedVehicleJourney>
            </VehicleJourneys>
          </Affects>
          <Consequences>
            <Consequence>
              <Condition>cancelled</Condition>
              <Severity>severe</Severity>
            </Consequence>
          </Consequences>
        </PtSituationElement>
      </Situations>
    </SituationExchangeDelivery>
  </ServiceDelivery>
</Siri>
`;

export const testSiriSxWithInvalidSituationsOnly = `<?xml version="1.0" encoding="utf-8"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd">
  <ServiceDelivery>
    <ResponseTimestamp>2024-10-09T12:00:00+00:00</ResponseTimestamp>
    <ProducerRef>ATB</ProducerRef>
    <Status>true</Status>
    <MoreData>false</MoreData>
    <SituationExchangeDelivery version="2.0">
      <ResponseTimestamp>2024-10-09T12:00:00+00:00</ResponseTimestamp>
      <SubscriberRef>555</SubscriberRef>
      <SubscriptionRef>556</SubscriptionRef>
      <Status>true</Status>
      <Situations>
        <PtSituationElement>
          <CreationTime>2024-10-09T11:45:00+00:00</CreationTime>
          <ParticipantRef>ATB</ParticipantRef>
          <SituationNumber>123</SituationNumber>
          <Version>2</Version>
          <Source>
            <SourceType>other</SourceType>
          </Source>
          <Progress>closed</Progress>
          <ValidityPeriod>
            <StartTime>2024-10-09T13:00:00+00:00</StartTime>
            <EndTime>2024-10-09T13:30:00+00:00</EndTime>
          </ValidityPeriod>
          <MiscellaneousReason>roadworks</MiscellaneousReason>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehicleJourneyRef>2</VehicleJourneyRef>
                <DatedVehicleJourneyRef>2</DatedVehicleJourneyRef>
                <Operator>
                  <OperatorRef>ABCD</OperatorRef>
                </Operator>
                <LineRef>1</LineRef>
                <PublishedLineName>1</PublishedLineName>
                <DirectionRef>Outbound</DirectionRef>
                <Origins>
                  <StopPointRef>01</StopPointRef>
                  <StopPointName>First</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Origins>
                <Destinations>
                  <StopPointRef>02</StopPointRef>
                  <StopPointName>Second</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Destinations>
                <Route />
                <Calls>
                  <Call>
                    <CallCondition>cancelled</CallCondition>
                  </Call>
                </Calls>
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
          <CreationTime>2024-10-09T11:45:00+00:00</CreationTime>
          <ParticipantRef>ATB</ParticipantRef>
          <SituationNumber>124</SituationNumber>
          <Source>
            <SourceType>email</SourceType>
          </Source>
          <Progress>closed</Progress>
          <ValidityPeriod>
            <StartTime>2024-10-09T13:00:00+00:00</StartTime>
            <EndTime>2024-10-09T13:30:00+00:00</EndTime>
          </ValidityPeriod>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehicleJourneyRef>3</VehicleJourneyRef>
                <DatedVehicleJourneyRef>3</DatedVehicleJourneyRef>
                <Operator>
                  <OperatorRef>ABCD</OperatorRef>
                </Operator>
                <LineRef>1</LineRef>
                <PublishedLineName>1</PublishedLineName>
                <DirectionRef>Outbound</DirectionRef>
                <Origins>
                  <StopPointRef>01</StopPointRef>
                  <StopPointName>First</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Origins>
                <Destinations>
                  <StopPointRef>02</StopPointRef>
                  <StopPointName>Second</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Destinations>
                <Route />
              </AffectedVehicleJourney>
            </VehicleJourneys>
          </Affects>
          <Consequences>
            <Consequence>
              <Condition>cancelled</Condition>
              <Severity>severe</Severity>
            </Consequence>
          </Consequences>
        </PtSituationElement>
      </Situations>
    </SituationExchangeDelivery>
  </ServiceDelivery>
</Siri>
`;

export const testSiriSxWithInvalidSituationsAndData = `<?xml version="1.0" encoding="utf-8"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd">
  <ServiceDelivery>
    <ResponseTimestamp>asdf</ResponseTimestamp>
    <ProducerRef>ATB</ProducerRef>
    <ResponseMessageIdentifier>444</ResponseMessageIdentifier>
    <Status>true</Status>
    <MoreData>false</MoreData>
    <SituationExchangeDelivery version="2.0">
      <ResponseTimestamp>2024-10-09T12:00:00+00:00</ResponseTimestamp>
      <SubscriberRef>555</SubscriberRef>
      <SubscriptionRef>556</SubscriptionRef>
      <Status>true</Status>
      <Situations>
        <PtSituationElement>
          <CreationTime>2024-10-09T11:45:00+00:00</CreationTime>
          <ParticipantRef>ATB</ParticipantRef>
          <SituationNumber>123</SituationNumber>
          <Version>2</Version>
          <Source>
            <SourceType>other</SourceType>
          </Source>
          <Progress>closed</Progress>
          <ValidityPeriod>
            <StartTime>2024-10-09T13:00:00+00:00</StartTime>
            <EndTime>2024-10-09T13:30:00+00:00</EndTime>
          </ValidityPeriod>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehicleJourneyRef>2</VehicleJourneyRef>
                <DatedVehicleJourneyRef>2</DatedVehicleJourneyRef>
                <Operator>
                  <OperatorRef>ABCD</OperatorRef>
                </Operator>
                <LineRef>1</LineRef>
                <PublishedLineName>1</PublishedLineName>
                <DirectionRef>Outbound</DirectionRef>
                <Origins>
                  <StopPointRef>01</StopPointRef>
                  <StopPointName>First</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Origins>
                <Destinations>
                  <StopPointRef>02</StopPointRef>
                  <StopPointName>Second</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Destinations>
                <Route />
              </AffectedVehicleJourney>
            </VehicleJourneys>
          </Affects>
          <Consequences>
            <Consequence>
              <Condition>cancelled</Condition>
              <Severity>severe</Severity>
            </Consequence>
          </Consequences>
        </PtSituationElement>
        <PtSituationElement>
          <CreationTime>2024-10-09T11:45:00+00:00</CreationTime>
          <ParticipantRef>ATB</ParticipantRef>
          <SituationNumber>124</SituationNumber>
          <Source>
            <SourceType>email</SourceType>
          </Source>
          <Progress>closed</Progress>
          <ValidityPeriod>
            <StartTime>2024-10-09T13:00:00+00:00</StartTime>
            <EndTime>2024-10-09T13:30:00+00:00</EndTime>
          </ValidityPeriod>
          <MiscellaneousReason>roadworks</MiscellaneousReason>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehicleJourneyRef>3</VehicleJourneyRef>
                <DatedVehicleJourneyRef>3</DatedVehicleJourneyRef>
                <Operator>
                  <OperatorRef>ABCD</OperatorRef>
                </Operator>
                <LineRef>1</LineRef>
                <PublishedLineName>1</PublishedLineName>
                <DirectionRef>Outbound</DirectionRef>
                <Origins>
                  <StopPointRef>01</StopPointRef>
                  <StopPointName>First</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Origins>
                <Destinations>
                  <StopPointRef>02</StopPointRef>
                  <StopPointName>Second</StopPointName>
                  <StopPointType>busStop</StopPointType>
                </Destinations>
                <Route />
              </AffectedVehicleJourney>
            </VehicleJourneys>
          </Affects>
          <Consequences>
            <Consequence>
              <Condition>cancelled</Condition>
              <Severity>severe</Severity>
            </Consequence>
          </Consequences>
        </PtSituationElement>
      </Situations>
    </SituationExchangeDelivery>
  </ServiceDelivery>
</Siri>
`;

export const testInvalidSiriSx = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
`;

export const parsedSiriSx: NewSituation[] = [
    {
        id: `${mockSubscriptionId}-123-2`,
        subscription_id: mockSubscriptionId,
        response_time_stamp: "2024-10-09T12:00:00+00:00",
        producer_ref: "ATB",
        situation_number: "123",
        version: 2,
        end_time: "2024-10-09T13:30:00.000Z",
        situation: {
            CreationTime: "2024-10-09T11:45:00+00:00",
            ParticipantRef: "ATB",
            SituationNumber: "123",
            Version: 2,
            Source: {
                SourceType: SourceType.other,
            },
            Progress: Progress.closed,
            ValidityPeriod: [
                {
                    StartTime: "2024-10-09T13:00:00+00:00",
                    EndTime: "2024-10-09T13:30:00+00:00",
                },
            ],
            MiscellaneousReason: MiscellaneousReason.roadworks,
            Affects: {
                VehicleJourneys: {
                    AffectedVehicleJourney: [
                        {
                            Calls: {
                                Call: [
                                    {
                                        CallCondition: "notStopping",
                                    },
                                ],
                            },
                            VehicleJourneyRef: "2",
                            DatedVehicleJourneyRef: "2",
                            Operator: {
                                OperatorRef: "ABCD",
                            },
                            LineRef: "1",
                            PublishedLineName: "1",
                            DirectionRef: "Outbound",
                            Origins: [
                                {
                                    StopPointRef: "01",
                                    StopPointName: "First",
                                    StopPointType: StopPointType.busStop,
                                },
                            ],
                            Destinations: [
                                {
                                    StopPointRef: "02",
                                    StopPointName: "Second",
                                    StopPointType: StopPointType.busStop,
                                },
                            ],
                            Route: {},
                        },
                    ],
                },
            },
            Consequences: {
                Consequence: [
                    {
                        Condition: Condition.cancelled,
                        Severity: Severity.unknown,
                    },
                ],
            },
        },
    },
    {
        id: `${mockSubscriptionId}-124-`,
        subscription_id: mockSubscriptionId,
        response_time_stamp: "2024-10-09T12:00:00+00:00",
        producer_ref: "ATB",
        situation_number: "124",
        version: undefined,
        end_time: "2024-07-23T12:00:00.000Z",
        situation: {
            CreationTime: "2024-10-09T11:45:00+00:00",
            ParticipantRef: "ATB",
            SituationNumber: "124",
            Source: {
                SourceType: SourceType.email,
            },
            Progress: Progress.closed,
            ValidityPeriod: [
                {
                    StartTime: "2024-10-09T13:00:00+00:00",
                },
            ],
            MiscellaneousReason: MiscellaneousReason.roadworks,
            Affects: {
                VehicleJourneys: {
                    AffectedVehicleJourney: [
                        {
                            Calls: {
                                Call: [
                                    {
                                        CallCondition: "stop",
                                    },
                                ],
                            },
                            VehicleJourneyRef: "3",
                            DatedVehicleJourneyRef: "3",
                            Operator: {
                                OperatorRef: "ABCD",
                            },
                            LineRef: "1",
                            PublishedLineName: "1",
                            DirectionRef: "Outbound",
                            Origins: [
                                {
                                    StopPointRef: "01",
                                    StopPointName: "First",
                                    StopPointType: StopPointType.busStop,
                                },
                            ],
                            Destinations: [
                                {
                                    StopPointRef: "02",
                                    StopPointName: "Second",
                                    StopPointType: StopPointType.busStop,
                                },
                            ],
                            Route: {},
                        },
                    ],
                },
            },
            Consequences: {
                Consequence: [
                    {
                        Condition: Condition.cancelled,
                        Severity: Severity.severe,
                    },
                ],
            },
        },
    },
];
