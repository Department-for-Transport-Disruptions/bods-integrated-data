import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { Handler } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { z } from "zod";
import { TflLinesSchema } from "./tfl-line.schema";

z.setErrorMap(errorMapWithDataLogging);

let lineIds: string[];

export const getLineIds = async () => {
    logger.info("Fetching TfL line IDs from API...");

    const url = "https://api.tfl.gov.uk/Line/Mode/bus";

    try {
        const response = await axios.get<TflLinesSchema>(url);

        return response.data.map((line) => line.id);
    } catch (e) {
        logger.error(e instanceof AxiosError ? e.toJSON() : e, `Error fetching TfL line IDs with URL ${url}`);

        throw e;
    }
};

export const handler: Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    try {
        logger.info("Attempting to retrieve TfL line IDs from cache...");

        lineIds = lineIds || (await getLineIds());

        return chunkArray(lineIds, 20).map((a) => ({ lineIds: a }));
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error retrieving TfL line IDs");
        }

        throw e;
    }
};
