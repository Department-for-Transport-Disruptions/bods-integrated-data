import { logger } from "@bods-integrated-data/shared/logger";
import { Command, Option } from "@commander-js/extra-typings";
import { STAGES, STAGE_OPTION, getDynamoDbItem, invokeLambda, withUserPrompts } from "../utils";

const notificationTypeChoices = ["Heartbeat Notification", "AVL Data"];

export const invokeAvlDataEndpoint = new Command("invoke-avl-data-endpoint")
    .addOption(STAGE_OPTION)
    .option("--subscriptionId <id>", "Subscription ID of the data producer")
    .addOption(new Option("-n, --notificationType <type>", "Notification type").choices(notificationTypeChoices))
    .action(async (options) => {
        const { stage, subscriptionId, notificationType } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            subscriptionId: { type: "input" },
            notificationType: { type: "list", choices: notificationTypeChoices },
        });

        const subscription = await getDynamoDbItem(stage, `integrated-data-avl-subscription-table-${stage}`, {
            PK: subscriptionId,
            SK: "SUBSCRIPTION",
        });

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

        const avlDataBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri xmlns="http://www.siri.org.uk/siri"
    xmlns:ns2="http://www.ifopt.org.uk/acsb"
    xmlns:ns3="http://www.ifopt.org.uk/ifopt"
    xmlns:ns4="http://datex2.eu/schema/2_0RC1/2_0"
    version="2.0">
    <ServiceDelivery>
        <ResponseTimestamp>${currentTime}</ResponseTimestamp>
        <ProducerRef>${subscriptionId}</ProducerRef>
        <VehicleMonitoringDelivery version="2.0">
            <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
            <VehicleActivity>
                <RecordedAtTime>${currentTime}</RecordedAtTime>
                <ValidUntilTime>${currentTime}</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-04-15</DataFrameRef>
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
                <RecordedAtTime>${currentTime}</RecordedAtTime>
                <ValidUntilTime>${currentTime}</ValidUntilTime>
                <MonitoredVehicleJourney>
                    <LineRef>ATB:Line:60</LineRef>
                    <DirectionRef>2</DirectionRef>
                    <OperatorRef>placeholder</OperatorRef>
                    <FramedVehicleJourneyRef>
                        <DataFrameRef>2024-04-15</DataFrameRef>
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

        const invokePayload = {
            body: notificationType === "Heartbeat Notification" ? heartbeatNotificationBody : avlDataBody,
            pathParameters: {
                subscriptionId,
            },
            queryStringParameters: {
                subscriptionId,
                apiKey: subscription.apiKey,
            },
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-bods-avl-data-endpoint-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });

        logger.info(`${notificationType} sent to data endpoint`);
    });
