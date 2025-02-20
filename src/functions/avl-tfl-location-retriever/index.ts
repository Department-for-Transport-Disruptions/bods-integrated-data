import { insertAvls } from "@bods-integrated-data/shared/avl/utils";
import { tflOperatorRef } from "@bods-integrated-data/shared/constants";
import { KyselyDb, NewAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { addMatchingTripToAvl } from "@bods-integrated-data/shared/gtfs-rt/utils";
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

export const retrieveTflVehicleLocations = async (
    lineIds: string[],
    tflApiKey: string,
    gtfsTripMapsTableName: string,
): Promise<NewAvl[]> => {
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

    return (
        await Promise.all(
            vehicleLocations.map(async (vehicleLocation) => {
                const parseResult = tflVehicleLocationSchemaTransformed.safeParse(vehicleLocation);

                if (!parseResult.success) {
                    logger.warn(
                        `Invalid TfL vehicle location with vehicle ref: ${vehicleLocation.vehicleRef}`,
                        parseResult.error.format(),
                    );
                    return [];
                }

                return await addMatchingTripToAvl(gtfsTripMapsTableName, {
                    ...parseResult.data,
                    operator_ref: tflOperatorRef,
                });
            }),
        )
    ).flat();
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        logger.info("Starting TfL location retriever");

        const { TFL_API_ARN: tflApiArn, GTFS_TRIP_MAPS_TABLE_NAME: gtfsTripMapsTableName } = process.env;

        if (!tflApiArn || !gtfsTripMapsTableName) {
            throw new Error("Missing env vars - TFL_API_ARN and GTFS_TRIP_MAPS_TABLE_NAME must be set");
        }

        const { live_vehicles_api_key } = await getSecret<TflApiKeys>({ SecretId: tflApiArn });
        const vehicleLocations = await retrieveTflVehicleLocations(
            event.lineIds,
            live_vehicles_api_key,
            gtfsTripMapsTableName,
        );

        await insertAvls(dbClient, vehicleLocations, "");

        logger.info(`TfL location retriever successful, retrieved ${vehicleLocations.length} vehicle locations`);
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
