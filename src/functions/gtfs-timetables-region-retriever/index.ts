import { logger } from "@baselime/lambda-logger";
import { GTFS_FILE_SUFFIX, REGIONS } from "@bods-integrated-data/shared/constants";
import { listS3Objects } from "@bods-integrated-data/shared/s3";
import { regionCodeSchema } from "@bods-integrated-data/shared/schema/misc.schema";
import { makeFilteredArraySchema, notEmpty } from "@bods-integrated-data/shared/utils";
import { APIGatewayProxyResultV2 } from "aws-lambda";

export const handler = async (): Promise<APIGatewayProxyResultV2> => {
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

        const validRegions = makeFilteredArraySchema(regionCodeSchema).parse(regionFileNames);

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
            logger.error("There was an error when retrieving GTFS regions.", e);
        }

        throw e;
    }
};
