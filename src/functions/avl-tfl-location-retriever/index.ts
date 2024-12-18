import { insertAvls } from "@bods-integrated-data/shared/avl/utils";
import { tflOperatorRef } from "@bods-integrated-data/shared/constants";
import { KyselyDb, NewAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { tflVehicleLocationSchemaTransformed } from "@bods-integrated-data/shared/schema";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios from "axios";
import { z } from "zod";
import { RealTimeVehicleLocationsApiResponse, TflApiKeys } from "./types";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const getLineIds = async (dbClient: KyselyDb) => {
    const lineIds = await dbClient.selectFrom("tfl_line").selectAll().execute();
    return lineIds.map((lineId) => lineId.id);
};

export const retrieveTflVehicleLocations = async (lineIds: string[], tflApiKey: string): Promise<NewAvl[]> => {
    const lineIdChunks = chunkArray(lineIds, 20);

    const requests = lineIdChunks.map(async (lineIdChunk) => {
        const url = `https://api.tfl.gov.uk/RealTimeVehicleLocation/Lines/${lineIdChunk.join(",")}`;

        try {
            const response = await axios.get<RealTimeVehicleLocationsApiResponse>(url, {
                headers: { app_key: tflApiKey },
            });

            return response.data;
        } catch (e) {
            if (e instanceof Error) {
                logger.error(e, `Error fetching TFL vehicle locations with chunk URL ${url}`);
            }

            return { lines: [] };
        }
    });

    const responses = await Promise.all(requests);
    const vehicleLocations = responses.flatMap((response) => response.lines.flatMap((line) => line.vehicles));

    return vehicleLocations.flatMap<NewAvl>((vehicleLocation) => {
        const parseResult = tflVehicleLocationSchemaTransformed.safeParse(vehicleLocation);

        if (!parseResult.success) {
            logger.warn(
                `Invalid TfL vehicle location with vehicle ref: ${vehicleLocation.vehicleRef}`,
                parseResult.error.format(),
            );
            return [];
        }

        return [parseResult.data];
    });
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        logger.info("Starting TfL location retriever");

        const { TFL_API_ARN: tflApiArn } = process.env;

        if (!tflApiArn) {
            throw new Error("Missing env vars - TFL_API_ARN must be set");
        }

        const { live_vehicles_api_key } = await getSecret<TflApiKeys>({ SecretId: tflApiArn });
        const lineIds = await getLineIds(dbClient);
        const vehicleLocations = await retrieveTflVehicleLocations(lineIds, live_vehicles_api_key);

        const vehicleLocationsWithTflOperatorRef = vehicleLocations.map((vehicleLocation) => {
            return {
                ...vehicleLocation,
                operator_ref: tflOperatorRef,
            };
        });

        await insertAvls(dbClient, vehicleLocationsWithTflOperatorRef, "");

        logger.info("TfL location retriever successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the TfL location retriever");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
