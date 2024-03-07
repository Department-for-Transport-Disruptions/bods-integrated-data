import { logger } from "@baselime/lambda-logger";
import { addIntervalToDate, getDate } from "@bods-integrated-data/shared";
import { parse } from "js2xmlparser";
import { randomUUID } from "crypto";
import { AvlSubscribeMessage, avlSubscribeMessageSchema, subscriptionRequestSchema } from "./subscriber.schema";

const mockEvent: { body: string } = {
    body: JSON.stringify({
        dataProducerEndpoint: "https://google.com",
        description: "description",
        shortDescription: "shortDescription",
    }),
};

const generateSubscriptionRequest = (
    avlSubscribeMessage: AvlSubscribeMessage,
    subscriptionId: string,
    currentTimestamp: string,
) => {
    return {
        SubscriptionRequest: {
            RequestTimeStamp: currentTimestamp,
            Address: `${avlSubscribeMessage.dataProducerEndpoint}/${subscriptionId}`,
            RequestorRef: "BODS",
            MessageIdentifier: randomUUID(),
            SubscriptionRequestContext: {
                HeartbeatInterval: "PT30M",
            },
            VehicleMonitoringSubscriptionRequest: {
                SubscriberRef: "BODS",
                SubscriptionIdentifier: subscriptionId,
                InitialTerminationTime: addIntervalToDate(currentTimestamp, 10, "years").toISOString(),
                VehicleMonitoringRequest: {
                    RequestTimestamp: currentTimestamp,
                },
            },
        },
    };
};

export const handler = (event: { body: string } = mockEvent) => {
    try {
        logger.info("Starting AVL subscriber");

        const parsedBody = avlSubscribeMessageSchema.safeParse(JSON.parse(event.body ?? ""));

        if (!parsedBody.success) {
            logger.error(JSON.stringify(parsedBody.error));
            return;
        }

        const avlSubscribeMessage = parsedBody.data;

        const subscriptionId = randomUUID();
        const currentTimestamp = getDate().toISOString();

        const subscriptionRequestMessage = generateSubscriptionRequest(
            avlSubscribeMessage,
            subscriptionId,
            currentTimestamp,
        );

        const verifiedSubscriptionRequest = subscriptionRequestSchema.parse(subscriptionRequestMessage);

        const completeObject = {
            "@": {
                version: "2.0",
                xmlns: "http://www.siri.org.uk/siri",
                "xmlns:ns2": "http://www.ifopt.org.uk/acsb",
                "xmlns:ns3": "http://www.ifopt.org.uk/ifopt",
                "xmlns:ns4": "http://datex2.eu/schema/2_0RC1/2_0",
            },
            "#": {
                SubscriptionRequest: {
                    ...verifiedSubscriptionRequest.SubscriptionRequest,
                    VehicleMonitoringSubscriptionRequest: {
                        ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest,
                        VehicleMonitoringRequest: {
                            "@": {
                                version: "2.0",
                            },
                            "#": {
                                ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest
                                    .VehicleMonitoringRequest,
                            },
                        },
                    },
                },
            },
        };

        const Siri = parse("Siri", completeObject, {
            declaration: {
                version: "1.0",
                encoding: "UTF-8",
                standalone: "yes",
            },
            useSelfClosingTagIfEmpty: true,
        });

        console.log(Siri);
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", e);

            throw e;
        }

        throw e;
    }
};
