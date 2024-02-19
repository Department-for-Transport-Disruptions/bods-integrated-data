import { Insertable, Selectable, Updateable } from "kysely";

export interface Database {
    naptan_stop: NaptanStopTable;
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

export type NaptanStop = Selectable<NaptanStopTable>;
export type NewNaptanStop = Insertable<NaptanStopTable>;
export type NaptanStopUpdate = Updateable<NaptanStopTable>;
