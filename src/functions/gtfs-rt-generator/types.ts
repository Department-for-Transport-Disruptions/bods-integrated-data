import { Avl } from "@bods-integrated-data/shared/database";

export type ExtendedAvl = Avl & {
    route_id?: number;
    trip_id?: string;
};
