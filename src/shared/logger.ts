import { logger as lambdaLogger } from "@baselime/lambda-logger";
import Pino from "pino";

/**
 * The logger will instantiate as either a lambda logger or pino logger, based on the runtime environment by checking the AWS_EXECUTION_ENV reserved variable:
 * https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#:~:text=Reference%20Guide.-,AWS_EXECUTION_ENV,-%E2%80%93%20The%20runtime%20identifier
 */
export const logger = process.env.AWS_EXECUTION_ENV?.startsWith("AWS_Lambda") ? lambdaLogger : Pino();
