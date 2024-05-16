import { Avl } from "../database";

export type ExtendedAvl = Avl & {
    route_id: number | null;
    trip_id: string | null;
};
