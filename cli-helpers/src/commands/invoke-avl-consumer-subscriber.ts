import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlConsumerSubscriber = new Command("invoke-avl-consumer-subscriber")
    .addOption(STAGE_OPTION)
    .option("--consumerSubscriptionId <consumerSubscriptionId>", "Consumer subscription ID")
    .option("--userId <userId>", "BODS user ID")
    .option("--subscriptionId <subscriptionId>", "Producer subscription IDs to subscribe to")
    .action(async (options) => {
        let { stage, consumerSubscriptionId, userId, subscriptionId } = options;

        if (!stage) {
            const responses = await inquirer.prompt<{ stage: string }>([
                {
                    name: "stage",
                    message: "Select the stage",
                    type: "list",
                    choices: STAGES,
                },
            ]);

            stage = responses.stage;
        }

        if (!consumerSubscriptionId) {
            const response = await inquirer.prompt<{ consumerSubscriptionId: string }>([
                {
                    name: "consumerSubscriptionId",
                    message: "Enter the consumer subscription ID",
                    type: "input",
                },
            ]);

            consumerSubscriptionId = response.consumerSubscriptionId;
        }

        if (!userId) {
            const response = await inquirer.prompt<{ userId: string }>([
                {
                    name: "userId",
                    message: "Enter the BODS user ID",
                    type: "input",
                },
            ]);

            userId = response.userId;
        }

        if (!subscriptionId) {
            const response = await inquirer.prompt<{ subscriptionId: string }>([
                {
                    name: "subscriptionId",
                    message: "Enter a comma-delimited list of producer subscription IDs to, up to five",
                    type: "input",
                },
            ]);

            subscriptionId = response.subscriptionId;
        }

        const requestBody = `<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Siri version=\"2.0\" xmlns=\"http://www.siri.org.uk/siri\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd\">
  <SubscriptionRequest>
    <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
    <ConsumerAddress>https://www.test.com/data</ConsumerAddress>
    <RequestorRef>test</RequestorRef>
    <MessageIdentifier>123</MessageIdentifier>
    <SubscriptionContext>
      <HeartbeatInterval>PT30S</HeartbeatInterval>
    </SubscriptionContext>
    <VehicleMonitoringSubscriptionRequest>
      <SubscriptionIdentifier>${consumerSubscriptionId}</SubscriptionIdentifier>
      <InitialTerminationTime>2034-03-11T15:20:02.093Z</InitialTerminationTime>
      <VehicleMonitoringRequest version=\"2.0\">
        <RequestTimestamp>2024-03-11T15:20:02.093Z</RequestTimestamp>
        <VehicleMonitoringDetailLevel>normal</VehicleMonitoringDetailLevel>
      </VehicleMonitoringRequest>
    </VehicleMonitoringSubscriptionRequest>
  </SubscriptionRequest>
</Siri>
`;

        const invokePayload = {
            headers: {
                userId,
            },
            queryStringParameters: {
                subscriptionId,
            },
            body: requestBody,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-subscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
