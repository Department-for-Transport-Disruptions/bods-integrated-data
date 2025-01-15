import { TxcSchema } from "@bods-integrated-data/shared/schema";
import { allowedStopTypes } from "@bods-integrated-data/shared/tnds-analyser/constants";
import { Observation } from "@bods-integrated-data/shared/tnds-analyser/schema";

export default (txcData: Partial<TxcSchema>, naptanStops: Record<string, string | null>): Observation[] => {
    const observations: Observation[] = [];

    const txcStops =
        txcData.TransXChange?.StopPoints?.AnnotatedStopPointRef?.map((stop) => ({
            stopPointRef: stop.StopPointRef,
            commonName: stop.CommonName,
        })) || [];

    if (txcStops.length) {
        for (const stop of txcStops) {
            const naptanStopRef = naptanStops[stop.stopPointRef];

            if (naptanStopRef === undefined) {
                observations.push({
                    serviceCode: "n/a",
                    lineName: "n/a",
                    observation: "Stop not found in NaPTAN",
                    category: "stop",
                    importance: "advisory",
                    details: `The ${stop.commonName} (${stop.stopPointRef}) stop is not registered with NaPTAN. Please check the ATCO code is correct or contact your local authority to register this stop with NaPTAN.`,
                    extraColumns: {
                        "Stop Name": stop.commonName,
                        "Stop Point Ref": stop.stopPointRef,
                    },
                });
            } else if (naptanStopRef && !allowedStopTypes.includes(naptanStopRef)) {
                observations.push({
                    serviceCode: "n/a",
                    lineName: "n/a",
                    observation: "Incorrect stop type",
                    category: "stop",
                    importance: "critical",
                    details: `The ${stop.commonName} (${stop.stopPointRef}) stop is registered as stop type ${
                        naptanStops[stop.stopPointRef]
                    } with NaPTAN. Expected bus stop types are ${allowedStopTypes.toString()}.`,
                    extraColumns: {
                        "Stop Name": stop.commonName,
                        "Stop Point Ref": stop.stopPointRef,
                    },
                });
            }
        }
    }
    return observations;
};
