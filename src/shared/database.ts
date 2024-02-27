import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { Kysely, PostgresDialect, Insertable, Selectable, Updateable } from "kysely";
import { Pool } from "pg";

const smClient = new SecretsManagerClient({ region: "eu-west-2" });

export const getDatabaseClient = async (isLocal = false) => {
    if (isLocal) {
        return new Kysely<Database>({
            dialect: new PostgresDialect({
                pool: new Pool({
                    host: "127.0.0.1",
                    port: 5432,
                    database: "bods_integrated_data",
                    user: "postgres",
                    password: "password",
                }),
            }),
        });
    }

    const { DB_HOST: dbHost, DB_PORT: dbPort, DB_SECRET_ARN: databaseSecretArn, DB_NAME: dbName } = process.env;

    if (!dbHost || !dbPort || !databaseSecretArn || !dbName) {
        throw new Error("Missing env vars");
    }

    const databaseSecret = await smClient.send(
        new GetSecretValueCommand({
            SecretId: databaseSecretArn,
        }),
    );

    if (!databaseSecret.SecretString) {
        throw new Error("Database secret could not be retrieved");
    }

    const parsedSecret = JSON.parse(databaseSecret.SecretString) as { username: string; password: string };

    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: new Pool({
                host: dbHost,
                port: Number(dbPort),
                database: dbName,
                user: parsedSecret.username,
                password: parsedSecret.password,
            }),
        }),
    });
};

export interface Database {
    naptan_stop: NaptanStopTable;
    naptan_stop_new: NaptanStopTable;
    naptan_stop_old: NaptanStopTable;
    avl: AvlTable;
}

export interface NaptanStopTable {
    atcoCode: string;
    naptanCode: string | null;
    plateCode: string | null;
    cleardownCode: string | null;
    commonName: string | null;
    commonNameLang: string | null;
    shortCommonName: string | null;
    shortCommonNameLang: string | null;
    landmark: string | null;
    landmarkLang: string | null;
    street: string | null;
    streetLang: string | null;
    crossing: string | null;
    crossingLang: string | null;
    indicator: string | null;
    indicatorLang: string | null;
    bearing: string | null;
    nptgLocalityCode: string | null;
    localityName: string | null;
    parentLocalityName: string | null;
    grandParentLocalityName: string | null;
    town: string | null;
    townLang: string | null;
    suburb: string | null;
    suburbLang: string | null;
    localityCentre: string | null;
    gridType: string | null;
    easting: string | null;
    northing: string | null;
    longitude: string | null;
    latitude: string | null;
    stopType: string | null;
    busStopType: string | null;
    timingStatus: string | null;
    defaultWaitTime: string | null;
    notes: string | null;
    notesLang: string | null;
    administrativeAreaCode: string | null;
    creationDateTime: string | null;
    modificationDateTime: string | null;
    revisionNumber: string | null;
    modification: string | null;
    status: string | null;
}

export interface AvlTable {
    responseTimeStamp: string | null;
    producerRef: string | null;
    recordedAtTime: string | null;
    validUntilTime: string;
    lineRef: string | null;
    directionRef: string | null;
    operatorRef: string | null;
    datedVehicleJourneyRef: string | null;
    vehicleRef: string | null;
    dataSource: string | null;
    longitude: string | null;
    latitude: string | null;
    bearing: string | null;
    delay: string | null;
    isCompleteStopSequence: string | null;
    publishedLineRef: string | null;
    originRef: string | null;
    destinationRef: string | null;
    blockRef: string | null;
}

export type NaptanStop = Selectable<NaptanStopTable>;
export type NewNaptanStop = Insertable<NaptanStopTable>;
export type NaptanStopUpdate = Updateable<NaptanStopTable>;
export type Avl = Selectable<AvlTable>
