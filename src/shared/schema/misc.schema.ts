import { z } from "zod";
import { regionCodes, regionNames } from "../constants";

export const regionCodeSchema = z.enum(regionCodes);
export const regionNameSchema = z.enum(regionNames);
