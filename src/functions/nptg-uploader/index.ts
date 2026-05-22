import { S3Client } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { nptgArrayProperties } from "@bods-integrated-data/shared/constants";
import {
    KyselyDb,
    NewNptgAdminArea,
    NewNptgLocality,
    NewNptgRegion,
    getDatabaseClient,
} from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { NptgSchema, nptgSchema } from "@bods-integrated-data/shared/schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { S3Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const getCrossAccountS3Client = async (roleArn: string, region: string) => {
    const stsClient = new STSClient({ region });

    const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: "nptg-uploader-cross-account-session",
        DurationSeconds: 3600,
    });

    const credentials = await stsClient.send(assumeRoleCommand);
    const assumedRoleCredentials = credentials.Credentials;

    if (
        !assumedRoleCredentials?.AccessKeyId ||
        !assumedRoleCredentials.SecretAccessKey ||
        !assumedRoleCredentials.SessionToken
    ) {
        throw new Error("Failed to assume role for cross-account S3 access");
    }

    return new S3Client({
        region,
        credentials: {
            accessKeyId: assumedRoleCredentials.AccessKeyId,
            secretAccessKey: assumedRoleCredentials.SecretAccessKey,
            sessionToken: assumedRoleCredentials.SessionToken,
        },
    });
};

const getAndParseData = async (bucket: string, key: string, roleArn: string, region: string) => {
    const s3Client = await getCrossAccountS3Client(roleArn, region);

    const file = await getS3Object(
        {
            Bucket: bucket,
            Key: key,
        },
        s3Client,
    );

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => nptgArrayProperties.includes(tagName),
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new Error("No xml data");
    }

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parseResult = nptgSchema.safeParse(parsedXml);

    if (!parseResult.success) {
        const validationError = fromZodError(parseResult.error);
        logger.error(validationError.toString());

        throw validationError;
    }

    return parseResult.data;
};

export const insertNptgData = async (dbClient: KyselyDb, data: NptgSchema) => {
    const { NptgLocalities, Regions } = data.NationalPublicTransportGazetteer;
    const adminAreas: NewNptgAdminArea[] = [];
    const localities: NewNptgLocality[] = [];
    const regions: NewNptgRegion[] = [];

    if (NptgLocalities) {
        for (const locality of NptgLocalities.NptgLocality) {
            localities.push({
                locality_code: locality.NptgLocalityCode,
                admin_area_ref: locality.AdministrativeAreaRef,
            });
        }
    }

    if (Regions) {
        for (const region of Regions.Region) {
            regions.push({
                region_code: region.RegionCode,
                name: region.Name,
            });

            if (region.AdministrativeAreas) {
                for (const adminArea of region.AdministrativeAreas.AdministrativeArea) {
                    adminAreas.push({
                        admin_area_code: adminArea.AdministrativeAreaCode,
                        atco_code: adminArea.AtcoAreaCode,
                        name: adminArea.Name,
                        region_code: region.RegionCode,
                    });
                }
            }
        }
    }

    const localityChunks = chunkArray(localities, 3000);

    await Promise.all([
        dbClient.insertInto("nptg_admin_area_new").values(adminAreas).execute(),
        localityChunks.map((chunk) => dbClient.insertInto("nptg_locality_new").values(chunk).execute()),
        dbClient.insertInto("nptg_region_new").values(regions).execute(),
    ]);
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        const externalBucketName = process.env.NAPTAN_BUCKET;
        const crossAccountRoleArn = process.env.NAPTAN_ARN;
        const bucketRegion = process.env.BUCKET_REGION;
        const nptgS3Key = process.env.NPTG_S3_KEY;

        if (!externalBucketName) {
            throw new Error("NAPTAN_BUCKET environment variable must be set");
        }

        if (!crossAccountRoleArn) {
            throw new Error("NAPTAN_ARN environment variable must be set");
        }

        if (!bucketRegion) {
            throw new Error("BUCKET_REGION environment variable must be set");
        }

        if (!nptgS3Key) {
            throw new Error("NPTG_S3_KEY environment variable must be set");
        }

        logger.info(`Starting NPTG uploader for ${nptgS3Key}`);

        const data = await getAndParseData(externalBucketName, nptgS3Key, crossAccountRoleArn, bucketRegion);
        await insertNptgData(dbClient, data);

        logger.info("NPTG uploader successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the NPTG uploader");
        }

        throw e;
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
