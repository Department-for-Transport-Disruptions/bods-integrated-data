import { LICENCE_NUMBER, TFLO_NOC } from "../constants";

export const getServiceCode = (lineId: string): string => `${LICENCE_NUMBER}:${lineId}`;

export const getTxcLineId = (lineId: string): string => `${TFLO_NOC}:${getServiceCode(lineId)}:${lineId}`;
