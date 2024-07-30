import { KyselyDb } from "@bods-integrated-data/shared/database";
import { FastifyInstance } from "fastify";
import { sql } from "kysely";

const healthCheck = async (fastify: FastifyInstance, dbClient: KyselyDb) => {
    fastify.get("/health", async (_request, reply) => {
        try {
            await sql`SELECT 1`.execute(dbClient);

            reply.send("ok");
        } catch (e) {
            fastify.log.error("Error connecting to DB");

            if (e instanceof Error) {
                fastify.log.error(e.stack);
            }

            reply.internalServerError();
        }
    });
};

export default healthCheck;
