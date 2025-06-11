import { SERVICE_CODE_PREFIX, TFLO_NOC } from "../constants";

export const getServiceCode = (lineId: string): string => `${SERVICE_CODE_PREFIX}:${lineId}`;

export const getTxcLineId = (lineId: string): string => `${TFLO_NOC}:${getServiceCode(lineId)}:${lineId}`;
