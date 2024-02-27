import { Database } from "../../shared";
import { Kysely, sql } from "kysely";

export type Logger = {
    info: (message: string) => void;
    error: (message: string | Error) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
};
export const getCurrentAvlData = async (db: Kysely<Database>, logger: Logger) => {
    logger.info("Getting AVL data from avl table...");

    const avl = await db
        .selectFrom("avl")
        .distinctOn("operatorRef" && "vehicleRef")
        .selectAll("avl")
        .orderBy("operatorRef" && "vehicleRef", "desc")
        .execute()

    return avl
}

const data = [{"id":11,"responseTimeStamp":"2024-02-26T11:31:12+00:00","producerRef":"BODS-AVL","recordedAtTime":"2024-02-26T11:31:12+00:00","validUntilTime":"2024-02-28 11:36:26","lineRef":"25","directionRef":"outbound","operatorRef":"GOGO","datedVehicleJourneyRef":"1","vehicleRef":"XYZ-123","dataSource":"BODS","longitude":"-1.5492094","latitude":"53.7949385","bearing":"90","delay":"0","isCompleteStopSequence":"No","publishedLineName":"25","originRef":"The Origin","destinationRef":"The Destination","blockRef":null},{"id":3,"responseTimeStamp":"2024-02-26T11:31:12+00:00","producerRef":"BODS-AVL","recordedAtTime":"2024-02-26T11:31:12+00:00","validUntilTime":"2024-02-26 11:36:26","lineRef":"33","directionRef":"outbound","operatorRef":"FMAN","datedVehicleJourneyRef":"1","vehicleRef":"ABC","dataSource":"BODS","longitude":"-1.5613995","latitude":"53.7920412","bearing":"90","delay":"0","isCompleteStopSequence":"No","publishedLineName":"33","originRef":"Bus Station","destinationRef":"The Destination","blockRef":null}]
