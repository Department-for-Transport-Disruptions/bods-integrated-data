import { z } from "zod";
import { regionCodes, regionNames } from "../constants";

export const regionCodeSchema = z.enum(regionCodes, { message: "Invalid region code" });
export const regionNameSchema = z.enum(regionNames, { message: "Invalid region name" });

export const normalizedStringSchema = z.string().transform(encodeURIComponent);

export const datetimeSchema = z.string().datetime({ offset: true, local: true });
