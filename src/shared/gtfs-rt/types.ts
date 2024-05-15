import { AvlBods } from "../database";

export type ExtendedAvl = AvlBods & {
    route_id: number | null;
    trip_id: string | null;
};
