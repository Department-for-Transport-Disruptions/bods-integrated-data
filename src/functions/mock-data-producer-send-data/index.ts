import { getAvlSubscriptions, getSiriVmValidUntilTimeOffset } from "@bods-integrated-data/shared/avl/utils";
import { getCancellationsSubscriptions } from "@bods-integrated-data/shared/cancellations/utils";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { AvlSubscription, CancellationsSubscription } from "@bods-integrated-data/shared/schema";
import { formatSiriDatetime } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios from "axios";
import { z } from "zod";
import { generateMockSiriCancellation } from "./mockSiriCancellation";
import { generateMockSiriVm } from "./mockSiriVm";

z.setErrorMap(errorMapWithDataLogging);

const getAvlRequestPromises = (
    stage: string,
    subscriptions: AvlSubscription[],
    dataEndpoint: string,
    currentTime: string,
    validUntilTime: string,
) => {
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

const getCancellationsRequestPromises = (
    stage: string,
    subscriptions: CancellationsSubscription[],
    dataEndpoint: string,
    currentTime: string,
) => {
    return subscriptions.map(async (subscription) => {
        const url =
            stage === "local"
                ? `${dataEndpoint}?subscriptionId=${subscription.PK}&apiKey=${subscription.apiKey}`
                : `${dataEndpoint}/${subscription.PK}?apiKey=${subscription.apiKey}`;

        const xml = generateMockSiriCancellation(subscription.PK, currentTime);

        await axios.post(url, xml, {
            headers: {
                "Content-Type": "text/xml",
            },
        });

        logger.info(`Successfully sent cancellations data to: ${url}`);
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
        const currentTime = formatSiriDatetime(responseTime, true);
        const validUntilTime = getSiriVmValidUntilTimeOffset(responseTime);

        const [avlSubscriptions, cancellationsSubscriptions] = await Promise.all([
            getAvlSubscriptions(AVL_TABLE_NAME),
            getCancellationsSubscriptions(CANCELLATIONS_TABLE_NAME),
        ]);

        const avlMockSubscriptions = avlSubscriptions.filter(
            (subscription) => subscription.requestorRef === "BODS_MOCK_PRODUCER" && subscription.status === "live",
        );
        const cancellationsMockSubscriptions = cancellationsSubscriptions.filter(
            (subscription) => subscription.requestorRef === "BODS_MOCK_PRODUCER" && subscription.status === "live",
        );

        if (!avlMockSubscriptions) {
            logger.info("No avl mock data producers are currently active");
        }

        if (!cancellationsMockSubscriptions) {
            logger.info("No cancellations mock data producers are currently active");
        }

        const avlRequests = getAvlRequestPromises(
            STAGE,
            avlMockSubscriptions,
            AVL_DATA_ENDPOINT,
            currentTime,
            validUntilTime,
        );

        const cancellationsRequests = getCancellationsRequestPromises(
            STAGE,
            cancellationsMockSubscriptions,
            CANCELLATIONS_DATA_ENDPOINT,
            currentTime,
        );

        const allRequests = [...avlRequests, ...cancellationsRequests];
        await Promise.all(allRequests);
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error when sending mock data");

            throw e;
        }

        throw e;
    }
};
