import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    logger.info(event.body);

    return {
        statusCode: Number(event.queryStringParameters?.statusCode) || 200,
        body: "",
    };
};
