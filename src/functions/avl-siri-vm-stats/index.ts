import { createHttpServerErrorResponse, createHttpSuccessResponse } from "@bods-integrated-data/shared/api";
import { getLatestAvlVehicleCount } from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

        const { vehicle_count: vehicleCount } = await getLatestAvlVehicleCount(dbClient);

        logger.info("Successfully retrieved latest AVL vehicle count.");

        return createHttpSuccessResponse(JSON.stringify({ num_of_siri_vehicles: vehicleCount }));
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the AVL SIRI-VM stats retriever");
        }

        return createHttpServerErrorResponse();
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
