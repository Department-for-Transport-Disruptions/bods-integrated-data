import { logger } from "@baselime/lambda-logger";
import { listS3Objects } from "@bods-integrated-data/shared/s3";
import { notEmpty } from "@bods-integrated-data/shared/utils";

const regionMappings: { [key: string]: string } = {
    ALL: "All",
    EA: "East Anglia",
    EM: "East Midlands",
    L: "London",
    S: "Scotland",
    SE: "South East",
    SW: "South West",
    NE: "North East",
    NW: "North West",
    W: "Wales",
    WM: "West Midlands",
    Y: "Yorkshire",
};

export const handler = async () => {
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
                body: [],
            };
        }

        const regionFileNames = objects.Contents?.map((item) => item.Key?.slice(0, -9).toUpperCase()).filter(notEmpty);

        const regions = regionFileNames.map((region) => ({
            regionCode: region,
            regionName: regionMappings[region],
        }));

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: regions,
        };
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error when retrieving GTFS regions.", e);
        }

        throw e;
    }
};
