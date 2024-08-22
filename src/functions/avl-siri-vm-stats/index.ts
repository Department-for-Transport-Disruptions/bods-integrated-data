import { createServerErrorResponse, createSuccessResponse } from "@bods-integrated-data/shared/api";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { APIGatewayProxyHandler } from "aws-lambda";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        const dbClient = await getDatabaseClient(process.env.STAGE === "local");

        const dayAgo = getDate().subtract(1, "day").toISOString();

        const avl = await dbClient
            .selectFrom("avl")
            .where("recorded_at_time", ">", dayAgo)
            .select((eb) => eb.fn.countAll<number>().as("vehicle_count"))
            .executeTakeFirst();

        return createSuccessResponse(JSON.stringify({ num_of_siri_vehicles: avl?.vehicle_count ?? null }));
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the AVL SIRI-VM stats retriever", e);
        }

        return createServerErrorResponse();
    }
};
