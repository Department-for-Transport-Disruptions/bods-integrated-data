import { TxcAnnotatedStopPointRef } from "@bods-integrated-data/shared/schema";
import { TflIBusData } from "./db";

export const generateStopPoints = (
    patterns: TflIBusData["patterns"],
): { AnnotatedStopPointRef: TxcAnnotatedStopPointRef[] } => {
    const allStops = patterns.flatMap((pattern) =>
        pattern.stops.map<TxcAnnotatedStopPointRef>((stop) => ({
            StopPointRef: stop.atco_code,
            CommonName: stop.common_name,
        })),
    );

    const uniqueStops = allStops.filter(
        (stop, index, self) => index === self.findIndex((s) => s.StopPointRef === stop.StopPointRef),
    );

    return {
        AnnotatedStopPointRef: uniqueStops,
    };
};
