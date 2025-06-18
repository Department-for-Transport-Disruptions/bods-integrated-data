import { GTFS_FILE_SUFFIX, REGIONS } from "@bods-integrated-data/shared/constants";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { listS3Objects } from "@bods-integrated-data/shared/s3";
import { regionCodeSchema } from "@bods-integrated-data/shared/schema/misc.schema";
import { makeFilteredArraySchema, notEmpty } from "@bods-integrated-data/shared/utils";
import { APIGatewayProxyHandler } from "aws-lambda";
import { z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Env var missing: BUCKET_NAME must be set.");
        }

        const objects = await listS3Objects({
            Bucket: bucketName,
        });

        if (!objects || !objects.Contents) {
            logger.warn("No files found in bucket.");

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: "[]",
            };
        }

        const regionFileNames = objects.Contents?.map((item) =>
            item.Key?.split(GTFS_FILE_SUFFIX)[0].toUpperCase(),
        ).filter(notEmpty);

        const validRegions = makeFilteredArraySchema("GtfsTimetablesRegionRetriever", regionCodeSchema).parse(
            regionFileNames,
        );

        const regions = validRegions
            .map((region) => {
                const regionInfo = REGIONS[region];

                if (!regionInfo) {
                    return null;
                }

                return {
                    regionCode: region,
                    regionDisplayName: regionInfo.regionDisplayName,
                    regionName: regionInfo.regionName,
                };
            })
            .filter(notEmpty);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(regions),
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was an error when retrieving GTFS regions.");
        }

        throw e;
    }
};
