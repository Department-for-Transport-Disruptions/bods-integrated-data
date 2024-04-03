import { Avl } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { transit_realtime } from "gtfs-realtime-bindings";
import { validate } from "uk-numberplate-format";
import { randomUUID } from "crypto";

const { OccupancyStatus } = transit_realtime.VehiclePosition;

export const getOccupancyStatus = (occupancy: string): transit_realtime.VehiclePosition.OccupancyStatus => {
    switch (occupancy) {
        case "full":
            return OccupancyStatus.FULL;
        case "seatsAvailable":
            return OccupancyStatus.MANY_SEATS_AVAILABLE;
        case "standingAvailable":
            return OccupancyStatus.STANDING_ROOM_ONLY;
        default:
            return OccupancyStatus.MANY_SEATS_AVAILABLE;
    }
};

export const mapAvlToGtfsEntity = async (avl: Avl): Promise<transit_realtime.IFeedEntity> => {
    const isValidRegistrationNumber = await new Promise((resolve) => {
        validate(avl.vehicle_ref, (error) => resolve(!error));
    });

    return {
        id: randomUUID(),
        vehicle: {
            occupancyStatus: avl.occupancy ? getOccupancyStatus(avl.occupancy) : null,
            position: {
                bearing: avl.bearing ? parseInt(avl.bearing) : 0,
                latitude: avl.latitude,
                longitude: avl.longitude,
            },
            vehicle: {
                id: avl.vehicle_ref,
                label: isValidRegistrationNumber ? avl.vehicle_ref : null,
            },
            trip: {
                // todo in BODS-3757
            },
            timestamp: getDate(avl.recorded_at_time).unix(),
        },
    };
};
