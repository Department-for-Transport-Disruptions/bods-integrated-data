import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Database } from "@bods-integrated-data/shared/database.types";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import {
    FileMigrationProvider,
    Kysely,
    Migrator,
    PostgresDialect,
} from "kysely";
import * as logger from "lambda-log";
import * as path from "path";
import { Pool } from "pg";

const smClient = new SecretsManagerClient({ region: "eu-west-2" });

export const handler = async () => {
    logger.options.dev = process.env.NODE_ENV !== "production";
    logger.options.debug =
        process.env.ENABLE_DEBUG_LOGS === "true" ||
        process.env.NODE_ENV !== "production";

    logger.options.meta = {
        id: randomUUID(),
    };

    const {
        DB_HOST: dbHost,
        DB_PORT: dbPort,
        DB_SECRET_ARN: databaseSecretArn,
        DB_NAME: dbName,
        ROLLBACK: rollback,
    } = process.env;

    if (!dbHost || !dbPort || !databaseSecretArn || !dbName) {
        throw new Error("Missing env vars");
    }

    const isRollback = rollback === "true";

    const databaseSecret = await smClient.send(
        new GetSecretValueCommand({
            SecretId: databaseSecretArn,
        })
    );

    if (!databaseSecret.SecretString) {
        throw new Error("Database secret could not be retrieved");
    }

    const parsedSecret = JSON.parse(databaseSecret.SecretString);

    const db = new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: new Pool({
                host: dbHost,
                port: Number(dbPort),
                database: dbName,
                user: parsedSecret.username,
                password: parsedSecret.password,
            }),
        }),
    });

    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
            fs,
            path,
            migrationFolder: path.join(__dirname, "./migrations"),
        }),
    });

    const { error, results } = isRollback
        ? await migrator.migrateDown()
        : await migrator.migrateToLatest();

    results?.forEach((it) => {
        if (it.status === "Success") {
            logger.info(
                `${isRollback ? "rollback of" : "migration "} ${
                    it.migrationName
                }" was executed successfully`
            );
        } else if (it.status === "Error") {
            logger.error(
                `failed to execute ${
                    isRollback ? "rollback of" : "migration"
                }  " ${it.migrationName}"`
            );
        }
    });

    if (error) {
        logger.error(`failed to ${isRollback ? "rollback" : "migrate"} `);
        logger.error(error as Error);
        process.exit(1);
    }

    await db.destroy();
};

handler().catch((e) => console.error(e));
