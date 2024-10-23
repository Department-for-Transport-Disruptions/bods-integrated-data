import { getDate } from "@bods-integrated-data/shared/dates";
import { program } from "commander";
import { STAGES, STAGE_OPTION, invokeLambda, withUserPrompts } from "../utils";
program
    .addOption(STAGE_OPTION)
    .option("--apiKey <apiKey>", "API key")
    .option("--consumerSubscriptionId <consumerSubscriptionId>", "Consumer subscription ID")
    .action(async (options) => {
        const { stage, apiKey, consumerSubscriptionId } = await withUserPrompts(options, {
            stage: { type: "list", choices: STAGES },
            apiKey: { type: "input" },
            consumerSubscriptionId: { type: "input" },
        });

        const requestBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Siri version="2.0" xmlns="http://www.siri.org.uk/siri"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd">
  <TerminateSubscriptionRequest>
    <RequestTimestamp>${getDate().toISOString()}</RequestTimestamp>
    <RequestorRef>BODS</RequestorRef>
    <MessageIdentifier>1</MessageIdentifier>
    <SubscriptionRef>${consumerSubscriptionId}</SubscriptionRef>
  </TerminateSubscriptionRequest>
</Siri>
`;

        const invokePayload = {
            headers: {
                "x-api-key": apiKey,
            },
            body: requestBody,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-unsubscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    })
    .parse();
