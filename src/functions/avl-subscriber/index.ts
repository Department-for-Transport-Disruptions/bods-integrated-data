import { randomUUID } from "node:crypto";
import { logger } from "@baselime/lambda-logger";
import { getSiriVmTerminationTimeOffset } from "@bods-integrated-data/shared/avl/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { putDynamoItem } from "@bods-integrated-data/shared/dynamo";
import {
    AvlSubscribeMessage,
    AvlSubscription,
    avlSubscribeMessageSchema,
    avlSubscriptionRequestSchema,
    avlSubscriptionResponseSchema,
} from "@bods-integrated-data/shared/schema/avl-subscribe.schema";
import { putParameter } from "@bods-integrated-data/shared/ssm";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { fromZodError } from "zod-validation-error";

export const generateSubscriptionRequestXml = (
    avlSubscribeMessage: AvlSubscribeMessage,
    subscriptionId: string,
    currentTimestamp: string,
    initialTerminationTime: string,
    messageIdentifier: string,
    dataEndpoint: string,
) => {
    const subscriptionRequestJson = {
        SubscriptionRequest: {
            RequestTimestamp: currentTimestamp,
            ConsumerAddress: `${dataEndpoint}/${subscriptionId}`,
            RequestorRef: avlSubscribeMessage.requestorRef ?? "BODS",
            MessageIdentifier: messageIdentifier,
            SubscriptionContext: {
                HeartbeatInterval: "PT30S",
            },
            VehicleMonitoringSubscriptionRequest: {
                SubscriptionIdentifier: subscriptionId,
                InitialTerminationTime: initialTerminationTime,
                VehicleMonitoringRequest: {
                    RequestTimestamp: currentTimestamp,
                },
            },
        },
    };

    const verifiedSubscriptionRequest = avlSubscriptionRequestSchema.parse(subscriptionRequestJson);

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
            SubscriptionRequest: {
                ...verifiedSubscriptionRequest.SubscriptionRequest,
                VehicleMonitoringSubscriptionRequest: {
                    ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest,
                    VehicleMonitoringRequest: {
                        "@_version": "2.0",
                        ...verifiedSubscriptionRequest.SubscriptionRequest.VehicleMonitoringSubscriptionRequest
                            .VehicleMonitoringRequest,
                    },
                },
            },
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        attributeNamePrefix: "@_",
    });

    const request = builder.build(completeObject) as string;

    return request;
};

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: true,
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = avlSubscriptionResponseSchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error(
            "There was an error parsing the subscription response from the data producer",
            parsedJson.error.format(),
        );
        return null;
    }

    return parsedJson.data;
};

const updateDynamoWithSubscriptionInfo = async (
    tableName: string,
    subscriptionId: string,
    avlSubscribeMessage: AvlSubscribeMessage,
    status: "ACTIVE" | "FAILED",
    currentTimestamp?: string,
) => {
    const subscriptionTableItems: Omit<AvlSubscription, "PK"> = {
        url: avlSubscribeMessage.dataProducerEndpoint,
        status: status,
        description: avlSubscribeMessage.description,
        shortDescription: avlSubscribeMessage.shortDescription,
        requestorRef: avlSubscribeMessage.requestorRef ?? null,
        serviceStartDatetime: currentTimestamp ?? null,
        publisherId: avlSubscribeMessage.publisherId ?? null,
    };

    logger.info("Updating DynamoDB with subscription information");

    await putDynamoItem(tableName, subscriptionId, "SUBSCRIPTION", subscriptionTableItems);
};

const addSubscriptionAuthCredsToSsm = async (subscriptionId: string, username: string, password: string) => {
    logger.info("Uploading subscription auth credentials to parameter store");

    await Promise.all([
        putParameter(`/subscription/${subscriptionId}/username`, username, "SecureString", true),
        putParameter(`/subscription/${subscriptionId}/password`, password, "SecureString", true),
    ]);
};

const sendSubscriptionRequestAndUpdateDynamo = async (
    subscriptionId: string,
    avlSubscribeMessage: AvlSubscribeMessage,
    tableName: string,
    dataEndpoint: string,
    mockProducerSubscribeEndpoint?: string,
) => {
    const requestTime = getDate();
    const currentTime = requestTime.toISOString();
    const initialTerminationTime = getSiriVmTerminationTimeOffset(requestTime);

    const messageIdentifier = randomUUID();

    const subscriptionRequestMessage = generateSubscriptionRequestXml(
        avlSubscribeMessage,
        subscriptionId,
        currentTime,
        initialTerminationTime,
        messageIdentifier,
        dataEndpoint,
    );

    const url =
        mockProducerSubscribeEndpoint && avlSubscribeMessage.requestorRef === "BODS_MOCK_PRODUCER"
            ? mockProducerSubscribeEndpoint
            : avlSubscribeMessage.dataProducerEndpoint;

    const subscriptionResponse = await axios.post<string>(url, subscriptionRequestMessage, {
        headers: {
            "Content-Type": "text/xml",
            Authorization: `Basic ${Buffer.from(
                `${avlSubscribeMessage.username}:${avlSubscribeMessage.password}`,
            ).toString("base64")}`,
        },
    });

    const subscriptionResponseBody = subscriptionResponse.data;

    if (!subscriptionResponseBody) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "FAILED");
        throw new Error(
            `No response body received from the data producer: ${avlSubscribeMessage.dataProducerEndpoint}`,
        );
    }

    const parsedResponseBody = parseXml(subscriptionResponseBody);

    if (!parsedResponseBody) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "FAILED");
        throw new Error(`Error parsing subscription response from: ${avlSubscribeMessage.dataProducerEndpoint}`);
    }

    if (!parsedResponseBody.SubscriptionResponse.ResponseStatus.Status) {
        await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "FAILED");
        throw new Error(
            `The data producer: ${avlSubscribeMessage.dataProducerEndpoint} did not return a status of true.`,
        );
    }

    await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "ACTIVE", currentTime);
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const {
            TABLE_NAME: tableName,
            STAGE: stage,
            MOCK_PRODUCER_SUBSCRIBE_ENDPOINT: mockProducerSubscribeEndpoint,
            DATA_ENDPOINT: dataEndpoint,
        } = process.env;

        if (!tableName || !dataEndpoint) {
            throw new Error("Missing env vars: TABLE_NAME and DATA_ENDPOINT must be set.");
        }

        if (stage === "local" && !mockProducerSubscribeEndpoint) {
            throw new Error("Missing env var: MOCK_PRODUCER_SUBSCRIBE_ENDPOINT must be set when STAGE === local");
        }

        logger.info("Starting AVL subscriber");

        const parsedBody = avlSubscribeMessageSchema.safeParse(JSON.parse(event.body ?? ""));

        if (!parsedBody.success) {
            const validationError = fromZodError(parsedBody.error);

            return {
                statusCode: 400,
                body: validationError.message,
            };
        }

        const avlSubscribeMessage = parsedBody.data;
        const { subscriptionId, username, password } = avlSubscribeMessage;
        await addSubscriptionAuthCredsToSsm(subscriptionId, username, password);

        try {
            await sendSubscriptionRequestAndUpdateDynamo(
                subscriptionId,
                avlSubscribeMessage,
                tableName,
                dataEndpoint,
                mockProducerSubscribeEndpoint,
            );
        } catch (e) {
            if (e instanceof AxiosError) {
                await updateDynamoWithSubscriptionInfo(tableName, subscriptionId, avlSubscribeMessage, "FAILED");
                logger.error(
                    `There was an error when sending the subscription request to the data producer - code: ${e.code}, message: ${e.message}`,
                );
            }

            throw e;
        }

        logger.info(`Successfully subscribed to data producer: ${avlSubscribeMessage.dataProducerEndpoint}.`);

        return {
            statusCode: 201,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", e);
        }

        throw e;
    }
};
