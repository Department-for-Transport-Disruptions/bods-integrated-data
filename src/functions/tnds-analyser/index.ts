import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { Handler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    logger.info("tnds-analyser stub function");
};
