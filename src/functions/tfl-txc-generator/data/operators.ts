import { Operator } from "@bods-integrated-data/shared/schema";
import { LICENCE_NUMBER, TFLO_NOC } from "../constants";

export const generateOperators = (): { Operator: Operator } => ({
    Operator: {
        "@_id": TFLO_NOC,
        NationalOperatorCode: TFLO_NOC,
        OperatorShortName: "Transport for London",
        LicenceNumber: LICENCE_NUMBER,
    },
});
