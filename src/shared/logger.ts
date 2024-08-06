import Pino, { Logger } from "pino";
import { lambdaRequestTracker, pinoLambdaDestination } from "pino-lambda";

// Define a custom logger type to allow extra props to be included in logs
type CustomLogger = Logger & {
    subscriptionId?: string;
};

export const logger = Pino(
    {
        mixin: (_mergeObject, _level, customLogger: CustomLogger) => ({
            subscriptionId: customLogger.subscriptionId,
        }),
    },
    pinoLambdaDestination(),
) as CustomLogger;

export const withLambdaRequestTracker = lambdaRequestTracker();
