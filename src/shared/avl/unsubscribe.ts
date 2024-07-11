import { randomUUID } from "node:crypto";
import axios from "axios";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { getDate } from "../dates";
import { putDynamoItem } from "../dynamo";
import { logger } from "../logger";
import { AvlSubscription } from "../schema/avl-subscribe.schema";
import {
    terminateSubscriptionRequestSchema,
    terminateSubscriptionResponseSchema,
} from "../schema/avl-unsubscribe.schema";
import { getSubscriptionUsernameAndPassword } from "../utils";
import { InvalidXmlError } from "../validation";

export const mockSubscriptionResponseBody = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<Siri version='2.0' xmlns='http://www.siri.org.uk/siri' xmlns:ns2='http://www.ifopt.org.uk/acsb' xmlns:ns3='http://www.ifopt.org.uk/ifopt' xmlns:ns4='http://datex2.eu/schema/2_0RC1/2_0'>
    <TerminateSubscriptionResponse>
        <TerminationResponseStatus>
            <ResponseTimestamp>2024-03-11T15:20:02.093Z</RequestTimeStamp>
            <SubscriptionRef>mock-subscription-id</SubscriptionRef>
            <Status>true</Status>
        </TerminationResponseStatus>
    </TerminateSubscriptionResponse>
</Siri>`;

export const generateTerminationSubscriptionRequest = (
    subscriptionId: string,
    currentTimestamp: string,
    messageIdentifier: string,
    requestorRef: string | null,
) => {
    const terminateSubscriptionRequestJson = {
        TerminateSubscriptionRequest: {
            RequestTimestamp: currentTimestamp,
            RequestorRef: requestorRef ?? "BODS",
            MessageIdentifier: messageIdentifier,
            SubscriptionRef: subscriptionId,
        },
    };

    const verifiedTerminateSubscriptionRequest = terminateSubscriptionRequestSchema.parse(
        terminateSubscriptionRequestJson,
    );

    const completeObject = {
        "?xml": {
            "#text": "",
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:ns2": "http://www.ifopt.org.uk/acsb",
            "@_xmlns:ns3": "http://www.ifopt.org.uk/ifopt",
            "@_xmlns:ns4": "http://datex2.eu/schema/2_0RC1/2_0",
            ...verifiedTerminateSubscriptionRequest,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
    });

    const request = builder.build(completeObject) as string;

    return request;
};

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = terminateSubscriptionResponseSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error(
            "There was an error parsing the terminate subscription response from the data producer",
            parsedJson.error.format(),
        );

        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

export const sendTerminateSubscriptionRequestAndUpdateDynamo = async (
    subscriptionId: string,
    subscription: Omit<AvlSubscription, "PK" | "status">,
    tableName: string,
) => {
    const currentTime = getDate().toISOString();
    const messageIdentifier = randomUUID();

    const terminateSubscriptionRequestMessage = generateTerminationSubscriptionRequest(
        subscriptionId,
        currentTime,
        messageIdentifier,
        subscription.requestorRef ?? null,
    );

    const { subscriptionUsername, subscriptionPassword } = await getSubscriptionUsernameAndPassword(subscriptionId);

    if (!subscriptionUsername || !subscriptionPassword) {
        logger.error(`Missing auth credentials for subscription id: ${subscriptionId}`);
        throw new Error("Missing auth credentials for subscription");
    }

    // TODO: This block of code is to mock out the data producers response when running locally, it will be removed
    //  when we create an unsubscribe endpoint for the mock data producer.
    const terminateSubscriptionResponse =
        (process.env.STAGE === "local" || process.env.STAGE === "dev" || process.env.STAGE === "test") &&
        subscription.requestorRef === "BODS_MOCK_PRODUCER"
            ? {
                  data: mockSubscriptionResponseBody,
                  status: 200,
              }
            : await axios.post<string>(subscription.url, terminateSubscriptionRequestMessage, {
                  headers: {
                      "Content-Type": "text/xml",
                      Authorization: `Basic ${Buffer.from(`${subscriptionUsername}:${subscriptionPassword}`).toString(
                          "base64",
                      )}`,
                  },
              });

    const terminateSubscriptionResponseBody = terminateSubscriptionResponse.data;

    if (!terminateSubscriptionResponseBody) {
        throw new Error(`No response body received from the data producer - subscription ID: ${subscriptionId}`);
    }

    const parsedResponseBody = parseXml(terminateSubscriptionResponseBody);

    if (parsedResponseBody.TerminateSubscriptionResponse.TerminationResponseStatus.Status !== "true") {
        throw new Error(`The data producer did not return a status of true - subscription ID: ${subscriptionId}`);
    }

    logger.info(
        `Successfully unsubscribed from subscription ID: ${subscriptionId} - updating subscription status in DynamoDB`,
    );

    await putDynamoItem(
        tableName,
        subscriptionId,
        "SUBSCRIPTION",

        {
            ...subscription,
            status: "INACTIVE",
            serviceEndDatetime: currentTime,
            lastModifiedDateTime: currentTime,
        },
    );
};
