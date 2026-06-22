import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { S3Client, getS3Object } from "@bods-integrated-data/shared/s3";
import { nocSchema } from "@bods-integrated-data/shared/schema/noc.schema";
import { S3Handler } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { insertNocOperator } from "./data/database";

z.setErrorMap(errorMapWithDataLogging);

let dbClient: KyselyDb;

const arrayProperties = ["NOCTableRecord"];
const nocLatestFilePath = "noc_latest_xml.xml";

const getNocObjectKey = (nocS3Key: string) => {
    const trimmedNocS3Key = nocS3Key.trim().replace(/\/+$/, "");

    if (!trimmedNocS3Key) {
        throw new Error("NOC_S3_KEY environment variable must not be empty");
    }

    return trimmedNocS3Key.endsWith(nocLatestFilePath)
        ? trimmedNocS3Key
        : `${trimmedNocS3Key}/${nocLatestFilePath}`;
};

const getCrossAccountS3Client = async (roleArn: string, region: string) => {
    const stsClient = new STSClient({ region });

    const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: "noc-uploader-cross-account-session",
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

const getAndParseData = async (bucketName: string, objectKey: string, roleArn: string, region: string) => {
    const s3Client = await getCrossAccountS3Client(roleArn, region);

    const file = await getS3Object(
        {
            Bucket: bucketName,
            Key: objectKey,
        },
        s3Client,
    );

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.includes(tagName),
    });

    const xml = await file.Body?.transformToString();

    if (!xml) {
        throw new Error("No xml data");
    }

    const parsedNoc = parser.parse(xml) as Record<string, unknown>;

    const nocJson = nocSchema.safeParse(parsedNoc);

    if (!nocJson.success) {
        const validationError = fromZodError(nocJson.error);
        logger.error(validationError.toString());

        throw validationError;
    }

    return nocJson.data;
};

export const handler: S3Handler = async (event, context) => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

    dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

    try {
        const externalBucketName = process.env.NOC_BUCKET_NAME;
        const crossAccountRoleArn = process.env.NOC_ROLE_ARN;
        const bucketRegion = process.env.BUCKET_REGION;
        const nocS3Key = process.env.NOC_S3_KEY;

        if (!externalBucketName) {
            throw new Error("NOC_BUCKET_NAME environment variable must be set");
        }

        if (!crossAccountRoleArn) {
            throw new Error("NOC_ROLE_ARN environment variable must be set");
        }

        if (!bucketRegion) {
            throw new Error("BUCKET_REGION environment variable must be set");
        }

        if (!nocS3Key) {
            throw new Error("NOC_S3_KEY environment variable must be set");
        }

        const nocObjectKey = getNocObjectKey(nocS3Key);

        logger.info(`Starting processing of NOC data for ${nocObjectKey}`);

        const nocData = await getAndParseData(externalBucketName, nocObjectKey, crossAccountRoleArn, bucketRegion);

        const { travelinedata } = nocData;

        if (!travelinedata.NOCTable.NOCTableRecord || travelinedata.NOCTable.NOCTableRecord.length === 0) {
            logger.warn(`No NOCTableRecords found in file ${nocObjectKey}`);
            return;
        }

        await insertNocOperator(dbClient, travelinedata.NOCTable.NOCTableRecord);

        logger.info("NOC processor successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error(e, "There was a problem with the NOC processor, rolling back transaction");
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
