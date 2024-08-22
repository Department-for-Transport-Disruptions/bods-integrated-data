import { createServerErrorResponse, createSuccessResponse } from "@bods-integrated-data/shared/api";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { APIGatewayProxyHandler } from "aws-lambda";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getLatestAvlVehicleCount } from "@bods-integrated-data/shared/avl/utils";

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const dbClient = await getDatabaseClient(process.env.STAGE === "local");

        const { vehicle_count: vehicleCount } = await getLatestAvlVehicleCount(dbClient);

        logger.info("Successfully retrieved latest AVL vehicle count.");

        return createSuccessResponse(JSON.stringify({ num_of_siri_vehicles: vehicleCount }));
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL SIRI-VM stats retriever", e);
        }

        return createServerErrorResponse();
    }
};
