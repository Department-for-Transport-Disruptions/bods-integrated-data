import { randomUUID } from "node:crypto";
import {
    GENERATED_SIRI_VM_FILE_PATH,
    GENERATED_SIRI_VM_TFL_FILE_PATH,
    createSiriVm,
    getAvlDataForSiriVm,
} from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { getPresignedUrl } from "@bods-integrated-data/shared/s3";
import {
    createBoundingBoxValidation,
    createNmTokenArrayValidation,
    createNmTokenValidation,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError, z } from "zod";

const requestParamsSchema = z.preprocess(
    Object,
    z.object({
        downloadTfl: createStringLengthValidation("downloadTfl").toLowerCase().optional(),
        boundingBox: createBoundingBoxValidation("boundingBox").optional(),
        operatorRef: createNmTokenArrayValidation("operatorRef").optional(),
        vehicleRef: createNmTokenValidation("vehicleRef").optional(),
        lineRef: createNmTokenValidation("lineRef").optional(),
        producerRef: createNmTokenValidation("producerRef").optional(),
        originRef: createNmTokenValidation("originRef").optional(),
        destinationRef: createNmTokenValidation("destinationRef").optional(),
        subscriptionId: createStringLengthValidation("subscriptionId").optional(),
    }),
);

const retrieveSiriVmData = async (
    dbClient: KyselyDb,
    boundingBox?: string,
    operatorRef?: string,
    vehicleRef?: string,
    lineRef?: string,
    producerRef?: string,
    originRef?: string,
    destinationRef?: string,
    subscriptionId?: string,
) => {
    const avls = await getAvlDataForSiriVm(
        dbClient,
        boundingBox,
        operatorRef,
        vehicleRef,
        lineRef,
        producerRef,
        originRef,
        destinationRef,
        subscriptionId,
    );

    const requestMessageRef = randomUUID();
    const responseTime = getDate();
    return createSiriVm(avls, requestMessageRef, responseTime);
};

const getSiriVmPresignedUrl = async (bucketName: string, key: string): Promise<string> =>
    getPresignedUrl(
        {
            Bucket: bucketName,
            Key: key,
            ResponseContentDisposition: "inline",
            ResponseContentType: "application/xml",
        },
        3600,
    );

export const downloadSiriVm = async (
    fastify: FastifyInstance,
    dbClient: KyselyDb,
    request: FastifyRequest,
    reply: FastifyReply,
) => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const {
            downloadTfl,
            boundingBox,
            operatorRef,
            vehicleRef,
            lineRef,
            producerRef,
            originRef,
            destinationRef,
            subscriptionId,
        } = requestParamsSchema.parse(request.query);

        if (
            boundingBox ||
            operatorRef ||
            vehicleRef ||
            lineRef ||
            producerRef ||
            originRef ||
            destinationRef ||
            subscriptionId
        ) {
            const siriVm = await retrieveSiriVmData(
                dbClient,
                boundingBox,
                operatorRef,
                vehicleRef,
                lineRef,
                producerRef,
                originRef,
                destinationRef,
                subscriptionId,
            );

            reply.headers({ "Content-Type": "application/xml" });

            return reply.send(siriVm);
        }

        if (downloadTfl === "true") {
            const presignedUrl = await getSiriVmPresignedUrl(bucketName, GENERATED_SIRI_VM_TFL_FILE_PATH);

            return reply.redirect(presignedUrl, 302);
        }

        const presignedUrl = await getSiriVmPresignedUrl(bucketName, GENERATED_SIRI_VM_FILE_PATH);

        return reply.redirect(presignedUrl, 302);
    } catch (e) {
        if (e instanceof ZodError) {
            const zodErrors = e.errors.map((error) => error.message).join(", ");
            fastify.log.warn(`Invalid request: ${zodErrors}`);

            return reply.badRequest(zodErrors);
        }

        if (e instanceof Error) {
            fastify.log.error("There was a problem with the SIRI-VM downloader endpoint", e);
        }

        return reply.internalServerError("An unexpected error occurred");
    }
};

const getSiriVm = async (fastify: FastifyInstance, dbClient: KyselyDb) => {
    fastify.get("/siri-vm", async (request, reply) => {
        await downloadSiriVm(fastify, dbClient, request, reply);
    });
};

export default getSiriVm;
