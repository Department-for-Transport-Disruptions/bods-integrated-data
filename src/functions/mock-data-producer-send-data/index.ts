import { getAvlSubscriptions, getSiriVmValidUntilTimeOffset } from "@bods-integrated-data/shared/avl/utils";
import { getCancellationsSubscriptions } from "@bods-integrated-data/shared/cancellations/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscription } from "@bods-integrated-data/shared/schema";
import { formatSiriVmDatetimes } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios from "axios";
import { generateMockSiriVm } from "./mockSiriVm";

const getAvlRequestPromises = (
    stage: string,
    subscriptions: AvlSubscription[],
    dataEndpoint: string,
    currentTime: string,
    validUntilTime: string,
) => {
    if (!subscriptions) {
        logger.info("No AVL mock data producers are currently active.");
    }

    return subscriptions.map(async (subscription) => {
        const url =
            stage === "local"
                ? `${dataEndpoint}?subscriptionId=${subscription.PK}&apiKey=${subscription.apiKey}`
                : `${dataEndpoint}/${subscription.PK}?apiKey=${subscription.apiKey}`;

        const xml = generateMockSiriVm(subscription.PK, currentTime, validUntilTime);

        await axios.post(url, xml, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        logger.info(`Successfully sent AVL data to: ${url}`);
    });
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const { STAGE, AVL_DATA_ENDPOINT, CANCELLATIONS_DATA_ENDPOINT, AVL_TABLE_NAME, CANCELLATIONS_TABLE_NAME } =
            process.env;

        if (
            !STAGE ||
            !AVL_DATA_ENDPOINT ||
            !CANCELLATIONS_DATA_ENDPOINT ||
            !AVL_TABLE_NAME ||
            !CANCELLATIONS_TABLE_NAME
        ) {
            throw new Error(
                "Missing env vars: STAGE, AVL_DATA_ENDPOINT, CANCELLATIONS_DATA_ENDPOINT, AVL_TABLE_NAME and CANCELLATIONS_TABLE_NAME must be set",
            );
        }

        const responseTime = getDate();
        const currentTime = formatSiriVmDatetimes(responseTime, true);
        const validUntilTime = getSiriVmValidUntilTimeOffset(responseTime);

        const avlSubscriptions = await getAvlSubscriptions(AVL_TABLE_NAME);
        const avlMockSubscriptions = avlSubscriptions.filter(
            (subscription) => subscription.requestorRef === "BODS_MOCK_PRODUCER" && subscription.status === "live",
        );

        const cancellationsSubscriptions = await getCancellationsSubscriptions(AVL_TABLE_NAME);
        const cancellationsMockSubscriptions = cancellationsSubscriptions.filter(
            (subscription) => subscription.requestorRef === "BODS_MOCK_PRODUCER" && subscription.status === "live",
        );

        const avlRequests = getAvlRequestPromises(
            STAGE,
            avlMockSubscriptions,
            AVL_DATA_ENDPOINT,
            currentTime,
            validUntilTime,
        );

        const cancellationsRequests = getAvlRequestPromises(
            STAGE,
            cancellationsMockSubscriptions,
            CANCELLATIONS_TABLE_NAME,
            currentTime,
            validUntilTime,
        );

        await Promise.all([...avlRequests, ...cancellationsRequests]);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error when sending AVL data");

            throw e;
        }

        throw e;
    }
};
