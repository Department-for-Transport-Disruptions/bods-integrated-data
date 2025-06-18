import { createHttpServerErrorResponse, createHttpValidationErrorResponse } from "@bods-integrated-data/shared/api";
import { GTFS_FILE_SUFFIX, REGIONS, RegionCode } from "@bods-integrated-data/shared/constants";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getPresignedUrl } from "@bods-integrated-data/shared/s3";
import { regionCodeSchema, regionNameSchema } from "@bods-integrated-data/shared/schema/misc.schema";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        regionCode: regionCodeSchema.optional(),
        regionName: regionNameSchema.optional(),
    }),
);

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const { regionCode, regionName } = requestParamsSchema.parse(event.queryStringParameters);

        let selectedRegionCode: RegionCode = "ALL";

        if (regionCode) {
            selectedRegionCode = regionCode;
        } else if (regionName) {
            const region = Object.values(REGIONS).find((region) => region.regionName === regionName);

            if (region) {
                selectedRegionCode = region.regionCode;
            }
        }

        const fileName = `${selectedRegionCode.toLowerCase()}${GTFS_FILE_SUFFIX}.zip`;

        const presignedUrl = await getPresignedUrl({ Bucket: bucketName, Key: fileName }, 3600);

        return {
            statusCode: 302,
            headers: {
                Location: presignedUrl,
            },
            body: "",
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the GTFS downloader endpoint");
        }

        return createHttpServerErrorResponse();
    }
};
