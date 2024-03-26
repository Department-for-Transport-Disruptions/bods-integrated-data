import { logger } from "@baselime/lambda-logger";
import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { sql } from "kysely";

export const handler = async () => {
    const { OUTPUT_BUCKET: outputBucket, IS_LOCAL: local } = process.env;

    if (!outputBucket) {
        throw new Error("Env vars must be set");
    }

    const isLocal = local === "true";

    const dbClient = await getDatabaseClient(isLocal);

    try {
        logger.info("Starting GTFS Timetable Generator");

        const agenciesQuery = dbClient
            .selectFrom("agency_new")
            .select([
                "agency_new.id as agency_id",
                "agency_new.name as agency_name",
                "agency_new.url as agency_url",
                "agency_new.timezone as agency_timezone",
                "agency_new.lang as agency_lang",
                "agency_new.phone as agency_phone",
                "agency_new.noc as agency_noc",
            ])
            .compile().sql;

        const queries = [{ query: agenciesQuery, path: "agency.txt" }];

        for await (const query of queries) {
            await sql`
                SELECT * from aws_s3.query_export_to_s3('${sql.raw(query.query)}', 
                    aws_commons.create_s3_uri('${outputBucket}', '${sql.raw(query.path)}', 'eu-west-2') 
                );`.execute(dbClient);
        }

        logger.info("GTFS Timetable Generator successful");
    } catch (e) {
        if (e instanceof Error) {
            logger.error("There was a problem with the GTFS Timetable Generator", e);
        }

        throw e;
    } finally {
        await dbClient.destroy();
    }
};
