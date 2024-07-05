import { logger as lambdaLogger } from "@baselime/lambda-logger";
import Pino from "pino";

export const logger = process.env.AWS_EXECUTION_ENV?.startsWith("AWS_Lambda") ? lambdaLogger : Pino();
