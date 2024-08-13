import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
    createServerErrorResponse,
    createUnauthorizedErrorResponse,
    createValidationErrorResponse,
} from "@bods-integrated-data/shared/api";
import {
    GENERATED_SIRI_VM_FILE_PATH,
    GENERATED_SIRI_VM_TFL_FILE_PATH,
    createSiriVm,
    getAvlDataForSiriVm,
} from "@bods-integrated-data/shared/avl/utils";
import { putMetricData } from "@bods-integrated-data/shared/cloudwatch";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import {
    InvalidApiKeyError,
    createBoundingBoxValidation,
    createNmTokenArrayValidation,
    createNmTokenValidation,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
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

const retrieveSiriVmFile = async (bucketName: string, key: string): Promise<string> => {
    const object = await getS3Object({
        Bucket: bucketName,
        Key: key,
        ResponseContentType: "application/xml",
    });

    return object.Body?.transformToString() || "";
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (event.path === "health") {
            return {
                statusCode: 200,
                body: "",
            };
        }

        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        let siriVm: string;

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
        } = requestParamsSchema.parse(event.queryStringParameters);

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
            const dbClient = await getDatabaseClient(process.env.STAGE === "local");

            siriVm = await retrieveSiriVmData(
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
        } else {
            siriVm = await retrieveSiriVmFile(
                bucketName,
                downloadTfl === "true" ? GENERATED_SIRI_VM_TFL_FILE_PATH : GENERATED_SIRI_VM_FILE_PATH,
            );
        }

        const gzip = gzipSync(siriVm);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/xml", "Content-Encoding": "gzip" },
            body: gzip.toString("base64"),
            isBase64Encoded: true,
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);

            await putMetricData("custom/SIRIVMDownloader", [
                {
                    MetricName: "4xx",
                    Value: 1,
                },
            ]);

            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            return createUnauthorizedErrorResponse();
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the SIRI-VM downloader endpoint", e);
        }

        await putMetricData("custom/SIRIVMDownloader", [
            {
                MetricName: "5xx",
                Value: 1,
            },
        ]);

        return createServerErrorResponse();
    }
};
