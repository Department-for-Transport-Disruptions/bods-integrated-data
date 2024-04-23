import { logger } from "@baselime/lambda-logger";
import {
    Database,
    NewNptgAdminArea,
    NewNptgLocality,
    NewNptgRegion,
    getDatabaseClient,
} from "@bods-integrated-data/shared/database";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import { NptgSchema, nptgSchema } from "@bods-integrated-data/shared/schema";
import { chunkArray } from "@bods-integrated-data/shared/utils";
import { S3Event } from "aws-lambda";
import { XMLParser } from "fast-xml-parser";
import { Kysely, sql } from "kysely";
import { fromZodError } from "zod-validation-error";

const arrayProperties = ["AdministrativeArea", "NptgLocality", "Region"];

const getAndParseData = async (bucket: string, key: string) => {
    const file = await getS3Object({
        Bucket: bucket,
        Key: key,
    });

    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: true,
        parseTagValue: false,
        isArray: (tagName) => arrayProperties.some((element) => element === tagName),
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

export const insertNptgData = async (dbClient: Kysely<Database>, data: NptgSchema) => {
    const { NptgLocalities, Regions } = data.NationalPublicTransportGazetteer;
    const adminAreas: NewNptgAdminArea[] = [];
    const localities: NewNptgLocality[] = [];
    const regions: NewNptgRegion[] = [];

    NptgLocalities?.NptgLocality.forEach((locality) => {
        localities.push({
            locality_code: locality.NptgLocalityCode,
            admin_area_ref: locality.AdministrativeAreaRef,
        });
    });

    Regions?.Region.forEach((region) => {
        regions.push({
            region_code: region.RegionCode,
            name: region.Name,
        });

        region.AdministrativeAreas?.AdministrativeArea.forEach((adminArea) => {
            adminAreas.push({
                admin_area_code: adminArea.AdministrativeAreaCode,
                atco_code: adminArea.AtcoAreaCode,
                name: adminArea.Name,
            });
        });
    });

    await Promise.all([
        dbClient.schema.dropTable("nptg_admin_area_new").ifExists().execute(),
        dbClient.schema.dropTable("nptg_locality_new").ifExists().execute(),
        dbClient.schema.dropTable("nptg_region_new").ifExists().execute(),
    ]);

    await Promise.all([
        sql`create table nptg_admin_area_new (LIKE nptg_admin_area INCLUDING ALL);`.execute(dbClient),
        sql`create table nptg_locality_new (LIKE nptg_locality INCLUDING ALL);`.execute(dbClient),
        sql`create table nptg_region_new (LIKE nptg_region INCLUDING ALL);`.execute(dbClient),
    ]);

    const localityChunks = chunkArray(localities, 3000);

    await Promise.all([
        dbClient.insertInto("nptg_admin_area_new").values(adminAreas).execute(),
        localityChunks.map((chunk) => dbClient.insertInto("nptg_locality_new").values(chunk).execute()),
        dbClient.insertInto("nptg_region_new").values(regions).execute(),
    ]);
};

export const handler = async (event: S3Event) => {
    const { bucket, object } = event.Records[0].s3;
    const dbClient = await getDatabaseClient(process.env.STAGE === "local");

    try {
        logger.info(`Starting NPTG uploader for ${object.key}`);

        const data = await getAndParseData(bucket.name, object.key);
        await insertNptgData(dbClient, data);

        logger.info("NPTG uploader successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the NPTG uploader", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
