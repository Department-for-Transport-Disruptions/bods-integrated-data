import { logger } from "@baselime/lambda-logger";
import { KyselyDb, NewAvl, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import axios from "axios";
import { RealTimeVehicleLocation, RealTimeVehicleLocationsApiResponse, TflApiKeys } from "./types";

const getLineIds = async (dbClient: KyselyDb) => {
    const lineIds = await dbClient.selectFrom("tfl_line").selectAll().execute();
    return lineIds.map((lineId) => lineId.id);
};

export const retrieveTflVehicleLocations = async (lineIds: string[], tflApiKey: string) => {
    const lineIdChunks = chunkArray(lineIds, 20);

    const requests = lineIdChunks.map(async (lineIdChunk) => {
        const url = "https://api.tfl.gov.uk/RealTimeVehicleLocation/Lines/" + lineIdChunk.join(",");

        try {
            const response = await axios.get<RealTimeVehicleLocationsApiResponse>(url, {
                headers: { app_key: tflApiKey },
            });

            return response.data;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Error fetching TFL vehicle locations with chunk URL ${url}`, error);
            }

            return { lines: [] };
        }
    });

    const responses = await Promise.all(requests);

    return responses.flatMap((response) => response.lines.flatMap((line) => line.vehicles));
};

export const mapVehicleLocation = (vehicle: RealTimeVehicleLocation): NewAvl => {
    const recordedAtTime = vehicle.recordedAtTime || getDate().toISOString();
    const originAimedDepartureTime = getDate()
        .startOf("day")
        .add(vehicle.originAimedDepartureTime || 0, "seconds")
        .toISOString();

    return {
        response_time_stamp: recordedAtTime,
        producer_ref: vehicle.producerRef || "",
        vehicle_ref: vehicle.vehicleRef || "",
        vehicle_name: vehicle.vehicleName,
        operator_ref: vehicle.operatorRef || "",
        monitored: vehicle.monitored,
        longitude: vehicle.longitude || 0,
        latitude: vehicle.latitude || 0,
        recorded_at_time: recordedAtTime,
        bearing: vehicle.bearing?.toString(),
        load: vehicle.load,
        passenger_count: vehicle.passengerCount,
        odometer: vehicle.odometer,
        headway_deviation: vehicle.headwayDeviation,
        schedule_deviation: vehicle.scheduleDeviation,
        vehicle_state: vehicle.vehicleState,
        next_stop_point_id: vehicle.nextStopPointId,
        next_stop_point_name: vehicle.nextStopPointName,
        previous_stop_point_id: vehicle.previousStopPointId,
        previous_stop_point_name: vehicle.previousStopPointName,
        line_ref: vehicle.lineRef,
        published_line_name: vehicle.publishedLineName,
        direction_ref: vehicle.directionRef?.toString(),
        origin_name: vehicle.originName,
        origin_ref: vehicle.originRef,
        origin_aimed_departure_time: originAimedDepartureTime,
        destination_name: vehicle.destinationName,
        destination_ref: vehicle.destinationRef,
        vehicle_journey_ref: vehicle.vehicleJourneyRef,
    };
};

const insertAvls = async (dbClient: KyselyDb, avls: NewAvl[]) => {
    const insertChunks = chunkArray(avls, 1000);
    await Promise.all(insertChunks.map((chunk) => dbClient.insertInto("avl").values(chunk).execute()));
};

export const handler = async () => {
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info("Starting TfL location retriever");

        const { TFL_API_ARN: tflApiArn } = process.env;

        if (!tflApiArn) {
            throw new Error("Missing env vars - TFL_API_ARN must be set");
        }

        const { liveVehiclesApiKey } = await getSecret<TflApiKeys>({ SecretId: tflApiArn });
        const lineIds = await getLineIds(dbClient);
        const vehicleLocations = await retrieveTflVehicleLocations(lineIds, liveVehiclesApiKey);

        await insertAvls(dbClient, vehicleLocations.map(mapVehicleLocation));

        logger.info("TfL location retriever successful");
    } catch (error) {
        if (error instanceof Error) {
            logger.error("There was a problem with the TfL location retriever", error);
        }

        throw error;
    } finally {
        await dbClient.destroy();
    }
};
