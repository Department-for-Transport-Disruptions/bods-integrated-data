import { z } from "zod";
import { regionCodes, regionNames } from "../constants";

export const regionCodeSchema = z.enum(regionCodes, { message: "Invalid region code" });
export const regionNameSchema = z.enum(regionNames, { message: "Invalid region name" });
