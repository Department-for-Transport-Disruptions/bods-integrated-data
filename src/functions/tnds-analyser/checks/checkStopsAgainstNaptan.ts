import { randomUUID } from "node:crypto";
import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { allowedStopTypes } from "@bods-integrated-data/shared/tnds-analyser/constants";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";

type NaptanStopData = {
    atcoCode: string;
    stopType: string | null;
};
export default (filename: string, data: Partial<TxcSchema>, naptanStops: NaptanStopData[]): Observation[] => {
    const observations: Observation[] = [];

    const txcStops =
        data.TransXChange?.StopPoints?.AnnotatedStopPointRef?.map((stop) => ({
            stopPointRef: stop.StopPointRef,
            commonName: stop.CommonName,
        })) || [];

    if (txcStops.length) {
        for (const stop of txcStops) {
            const naptanStop = naptanStops.find((naptanStop) => naptanStop.atcoCode === stop.stopPointRef);

            if (!naptanStop) {
                observations.push({
                    registrationNumber: "n/a",
                    service: "n/a",
                    PK: filename,
                    SK: randomUUID(),
                    observation: "Stop not found in NaPTAN",
                    category: "stop",
                    importance: "advisory",
                    details: `The ${stop.commonName} (${stop.stopPointRef}) stop is not registered with NaPTAN. Please check the ATCO code is correct or contact your local authority to register this stop with NaPTAN.`,
                });
            } else if (!allowedStopTypes.includes(naptanStop.stopType ?? "")) {
                observations.push({
                    registrationNumber: "n/a",
                    service: "n/a",
                    PK: filename,
                    SK: randomUUID(),
                    observation: "Incorrect stop type",
                    category: "stop",
                    importance: "critical",
                    details: `The ${stop.commonName} (${stop.stopPointRef}) stop is registered as stop type ${
                        naptanStop.stopType
                    } with NaPTAN. Expected bus stop types are ${allowedStopTypes.toString()}.`,
                });
            }
        }
    }
    return observations;
};
