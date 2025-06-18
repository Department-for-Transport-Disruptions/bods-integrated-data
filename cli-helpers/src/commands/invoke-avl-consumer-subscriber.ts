import { Option } from "@commander-js/extra-typings";
import { program } from "commander";
import { invokeLambda, STAGE_OPTION, STAGES, withUserPrompts } from "../utils";

const frequencyChoices = ["10", "15", "20", "30"];

program
    .addOption(STAGE_OPTION)
    .option("--apiKey <apiKey>", "API key")
    .option("--name <name>", "Subscription name")
    .option("--consumerSubscriptionId <consumerSubscriptionId>", "Consumer subscription ID")
    .option("--subscriptionId <subscriptionId>", "Producer subscription IDs to subscribe to")
    .addOption(
        new Option("--frequencyInSeconds <frequencyInSeconds>", "Frequency in seconds").choices(frequencyChoices),
    )
    .action(async (options) => {
        const { stage, apiKey, name, consumerSubscriptionId, subscriptionId, frequencyInSeconds } =
            await withUserPrompts(options, {
                stage: { type: "list", choices: STAGES },
                apiKey: { type: "input" },
                name: { type: "input" },
                consumerSubscriptionId: { type: "input" },
                subscriptionId: { type: "input" },
                frequencyInSeconds: { type: "list", choices: frequencyChoices },
            });

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
      <UpdateInterval>PT${frequencyInSeconds}S</UpdateInterval>
    </VehicleMonitoringSubscriptionRequest>
  </SubscriptionRequest>
</Siri>
`;

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            queryStringParameters: {
                name,
                subscriptionId,
            },
            body: requestBody,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-subscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    })
    .parse();
