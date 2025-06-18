import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { Option } from "@commander-js/extra-typings";
import { program } from "commander";
import { getDynamoDbItem, invokeLambda, STAGE_OPTION, STAGES, withUserPrompts } from "../utils";
import { createDynamoDbDocClient } from "../utils/awsClients";

const notificationTypeChoices = ["Heartbeat Notification", "Cancellations Data"];

program
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <id>", "Subscription ID of the data producer")
    .addOption(new Option("-n, --notificationType <type>", "Notification type").choices(notificationTypeChoices))
    .action(async (options) => {
        const { stage, subscriptionId, notificationType } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            subscriptionId: { type: "input" },
            notificationType: { type: "list", choices: notificationTypeChoices },
        });

        const dynamoDbClient = createDynamoDbDocClient(stage);
        const subscription = await getDynamoDbItem(
            dynamoDbClient,
            `integrated-data-cancellations-subscription-table-${stage}`,
            {
                PK: subscriptionId,
                SK: "SUBSCRIPTION",
            },
        );
        dynamoDbClient.destroy();

        if (!subscription) {
            logger.error(`Subscription with ID not found: ${subscriptionId}`);
            return;
        }

        const currentTime = new Date().toISOString();

        const heartbeatNotificationBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri>
  <HeartbeatNotification>
  <RequestTimestamp>${currentTime}</RequestTimestamp>
  <ProducerRef>${subscriptionId}</ProducerRef>
  <Status>true</Status>
  <ServiceStartedTime>2024-04-15T13:25:00+01:00</ServiceStartedTime>
  </HeartbeatNotification>
</Siri>`;

        const cancellationsDataBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>${currentTime}</ResponseTimestamp>
        <ProducerRef>${subscriptionId}</ProducerRef>
        <Status>true</Status>
        <MoreData>false</MoreData>
        <SituationExchangeDelivery version="2.0">
            <ResponseTimestamp>${currentTime}</ResponseTimestamp>
            <SubscriberRef>97755CE8-A6EB-4EA8-ABB4-96FE7AC51788</SubscriberRef>
            <SubscriptionRef>30429AC6-A904-4F23-80BF-1BCCBDE39285</SubscriptionRef>
            <Status>true</Status>
            <Situations>
                <PtSituationElement>
                    <CreationTime>${currentTime}</CreationTime>
                    <ParticipantRef>TKTR01L</ParticipantRef>
                    <SituationNumber>7980741</SituationNumber>
                    <Version>1</Version>
                    <Progress>open</Progress>
                    <ValidityPeriod>
                        <StartTime>2024-07-05T14:39:00Z</StartTime>
                        <EndTime>${getDate(currentTime).add(24, "hours").toISOString()}</EndTime>
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

        const invokePayload = {
            body: notificationType === "Heartbeat Notification" ? heartbeatNotificationBody : cancellationsDataBody,
            pathParameters: {
                subscriptionId,
            },
            queryStringParameters: {
                subscriptionId,
                apiKey: subscription.apiKey,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-cancellations-data-endpoint-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`${notificationType} sent to data endpoint`);
    })
    .parse();
