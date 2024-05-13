import { logger } from "@baselime/lambda-logger";
import { listS3Objects } from "@bods-integrated-data/shared/s3";
import { notEmpty } from "@bods-integrated-data/shared/utils";

const regionMappings: { [key: string]: string } = {
    L: "London",
    ALL: "All",
    EA: "East Anglia",
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
            return [];
        }

        const regionFileNames = objects.Contents?.map((item) => item.Key?.slice(0, -9).toUpperCase()).filter(notEmpty);

        const res = regionFileNames.map((region) => ({
            regionCode: region,
            regionName: regionMappings[region],
        }));

        logger.info("data", res);
        return res;
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was an error when retrieving GTFS regions.", e);
        }

        throw e;
    }
};
