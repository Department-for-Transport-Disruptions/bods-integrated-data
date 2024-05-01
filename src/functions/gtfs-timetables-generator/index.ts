import { logger } from "@baselime/lambda-logger";
import { Database, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { createLazyDownloadStreamFrom, startS3Upload } from "@bods-integrated-data/shared/s3";
import archiver from "archiver";
import { Kysely, sql } from "kysely";
import { PassThrough } from "stream";
import { Query, queryBuilder, regionalQueryBuilder } from "./queries";

const exportDataToS3 = async (queries: Query[], outputBucket: string, dbClient: Kysely<Database>) => {
    await Promise.all(
        queries.map((query) => {
            let options = "format csv, header true";

            if (!!query.forceQuote?.length) {
                options += `, force_quote(${query.forceQuote.join(",")})`;
            }

            return sql`
                SELECT * from aws_s3.query_export_to_s3('${sql.raw(query.getQuery())}',
                    aws_commons.create_s3_uri('${sql.raw(outputBucket)}', '${sql.raw(query.fileName)}.txt', 'eu-west-2'),
                    options :='${sql.raw(options)}'
                );
            `.execute(dbClient);
        }),
    );
};

export const handler = async (payload: { regionCode: string }) => {
    const { OUTPUT_BUCKET: outputBucket, GTFS_BUCKET: gtfsBucket, STAGE: stage } = process.env;

    if (!outputBucket || !gtfsBucket) {
        throw new Error("Env vars must be set");
    }

    const dbClient = await getDatabaseClient(stage === "local");

    try {
        logger.info("Starting GTFS Timetable Generator");

        let queries: Query[];

        if (!!payload.regionCode) {
            await sql`
                CREATE TEMP TABLE ${sql.table(`trip_${payload.regionCode}`)} (LIKE trip INCLUDING DEFAULTS);

                INSERT INTO ${sql.table(`trip_${payload.regionCode}`)}
                SELECT DISTINCT t.* FROM trip t
                JOIN stop_time st ON st.trip_id = t.id
                JOIN stop s ON s.id = st.stop_id
                WHERE s.region_code = ${payload.regionCode};
            `.execute(dbClient);

            queries = regionalQueryBuilder(dbClient, payload.regionCode);
        } else {
            queries = queryBuilder(dbClient);
        }

        await exportDataToS3(queries, outputBucket, dbClient);

        const archive = archiver("zip", {});

        try {
            const passThrough = new PassThrough();
            archive.pipe(passThrough);
            const upload = startS3Upload(
                gtfsBucket,
                `${payload.regionCode ?? "gtfs"}.zip`,
                passThrough,
                "application/zip",
            );

            for (const query of queries) {
                const file = `${query.fileName}.txt`;
                const downloadStream = createLazyDownloadStreamFrom(outputBucket, file);

                archive.append(downloadStream, {
                    name: file,
                });
            }

            void archive.finalize();

            await upload.done();
        } catch (e) {
            archive.abort();
            throw e;
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
