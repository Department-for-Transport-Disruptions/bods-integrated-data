import { getDatabaseClient } from "@bods-integrated-data/shared/database";
import { fastifySensible } from "@fastify/sensible";
import Fastify from "fastify";
import healthCheck from "./routes/health";
import downloadSiriVm from "./routes/siri-vm";

const fastify = Fastify({
    logger: true,
});

const { PORT: port = "8080", STAGE: stage } = process.env;

void (async () => {
    const dbClient = await getDatabaseClient(stage === "local", true);

    await fastify.register(fastifySensible);
    await fastify.register((fastify) => healthCheck(fastify, dbClient));
    await fastify.register((fastify) => downloadSiriVm(fastify, dbClient));

    await fastify.listen({ host: "0.0.0.0", port: Number.parseInt(port, 10) }, (err, host) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        fastify.log.info(`Server listening at ${host}`);
    });
})();
