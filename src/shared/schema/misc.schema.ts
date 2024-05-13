import { z } from "zod";
import { regionCodes } from "../constants";

export const regionCodeSchema = z.enum(regionCodes);
