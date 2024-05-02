import { Avl } from "../database";

export type ExtendedAvl = Avl & {
    route_id?: number;
    trip_id?: string;
};
