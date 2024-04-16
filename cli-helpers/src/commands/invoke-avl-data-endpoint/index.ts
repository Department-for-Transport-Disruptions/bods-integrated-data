import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Command, Flags } from "@oclif/core";
import inquirer from "inquirer";

const localStackHost = process.env.LOCALSTACK_HOSTNAME;

export default class InvokeAvlDataEndpoint extends Command {
    static description = "Invoke AVL data endpoint";

    static flags = {
        stage: Flags.string({ description: "Stage to use" }),
        subscriptionId: Flags.string({ description: "Subscription ID of the data producer" }),
        notificationType: Flags.string({ description: "Notification type: Heartbeat Notification or AVL data" }),
    };

    async run(): Promise<void> {
        const { flags } = await this.parse(InvokeAvlDataEndpoint);

        let { stage, subscriptionId, notificationType } = flags;

        if (!stage) {
            const responses = await inquirer.prompt<{ stage: string }>([
                {
                    name: "stage",
                    message: "Select the stage",
                    type: "list",
                    choices: ["local", "dev"],
                },
            ]);

            stage = responses.stage;
        }

        if (!notificationType) {
            const responses = await inquirer.prompt<{ notificationType: string }>([
                {
                    name: "notificationType",
                    message: "Select the notification type",
                    type: "list",
                    choices: ["Heartbeat Notification", "AVL Data"],
                },
            ]);

            notificationType = responses.notificationType;
        }

        if (!subscriptionId) {
            const responses = await inquirer.prompt<{ subscriptionId: string }>([
                {
                    name: "subscriptionId",
                    message: "Enter the subscription ID of the data producer",
                    type: "input",
                },
            ]);

            subscriptionId = responses.subscriptionId;
        }

        const lambdaClient = new LambdaClient({
            region: "eu-west-2",
            ...(stage === "local"
                ? {
                      endpoint: localStackHost ? `http://${localStackHost}:4566` : "http://localhost:4566",
                      credentials: {
                          accessKeyId: "DUMMY",
                          secretAccessKey: "DUMMY",
                      },
                  }
                : {}),
        });

        const heartbeatNotificationBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Siri>
      <HeartbeatNotification>
      <RequestTimestamp>${new Date().toISOString()}</RequestTimestamp>
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
            <ResponseTimestamp>${new Date().toISOString()}</ResponseTimestamp>
            <ProducerRef>${subscriptionId}</ProducerRef>
            <VehicleMonitoringDelivery version="2.0">
                <ResponseTimestamp>2018-08-17T15:14:21.432</ResponseTimestamp>
                <VehicleActivity>
                    <RecordedAtTime>${new Date().toISOString()}</RecordedAtTime>
                    <ValidUntilTime>${new Date().toISOString()}</ValidUntilTime>
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
                    <RecordedAtTime>${new Date().toISOString()}</RecordedAtTime>
                    <ValidUntilTime>${new Date().toISOString()}</ValidUntilTime>
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
                subscription_id: subscriptionId,
            },
            queryStringParameters: {
                subscription_id: subscriptionId,
            },
        };

        await lambdaClient.send(
            new InvokeCommand({
                FunctionName: `integrated-data-bods-avl-data-endpoint-${stage}`,
                InvocationType: "Event",
                Payload: JSON.stringify(invokePayload),
            }),
        );

        // eslint-disable-next-line no-console
        console.log(`${notificationType} sent to data endpoint`);
    }
}
