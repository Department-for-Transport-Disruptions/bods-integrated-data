import { z } from "zod";
import { RegionCode } from "../constants";

export const regionCodeSchema = z.nativeEnum(RegionCode);
