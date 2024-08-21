import { getDate } from "@bods-integrated-data/shared/dates";
import { Command } from "@commander-js/extra-typings";
import inquirer from "inquirer";
import { STAGES, STAGE_OPTION, invokeLambda } from "../utils";

export const invokeAvlConsumerUnsubscriber = new Command("invoke-avl-consumer-unsubscriber")
    .addOption(STAGE_OPTION)
    .option("--consumerSubscriptionId <consumerSubscriptionId>", "Consumer subscription ID")
    .action(async (options) => {
        let { stage, consumerSubscriptionId } = options;

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
            body: requestBody,
        };

        await invokeLambda(stage, {
            FunctionName: `integrated-data-avl-consumer-unsubscriber-${stage}`,
            InvocationType: "RequestResponse",
            Payload: JSON.stringify(invokePayload),
        });
    });
