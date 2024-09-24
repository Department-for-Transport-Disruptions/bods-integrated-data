import { createSuccessResponse } from "@bods-integrated-data/shared/api";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    logger.info(event.body);

    return createSuccessResponse();
};
