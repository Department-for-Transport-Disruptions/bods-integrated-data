import { randomUUID } from "node:crypto";
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
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import { getPresignedUrl } from "@bods-integrated-data/shared/s3";
import { getSecret } from "@bods-integrated-data/shared/secretsManager";
import {
    InvalidApiKeyError,
    createBoundingBoxValidation,
    createNmTokenArrayValidation,
    createNmTokenValidation,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyEventHeaders, APIGatewayProxyResult } from "aws-lambda";
import { ZodError, z } from "zod";
import { createResponseStream, streamifyResponse } from "./utils";

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

const validateApiKey = async (secretArn: string, headers: APIGatewayProxyEventHeaders) => {
    const requestApiKey = headers["x-api-key"];

    if (!requestApiKey) {
        throw new InvalidApiKeyError();
    }

    const storedApiKey = await getSecret<string>({ SecretId: secretArn });

    if (requestApiKey !== storedApiKey) {
        throw new InvalidApiKeyError();
    }
};

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

const retrieveSiriVmFile = async (bucketName: string, key: string): Promise<APIGatewayProxyResult> => {
    const presignedUrl = await getPresignedUrl(
        {
            Bucket: bucketName,
            Key: key,
            ResponseContentDisposition: "inline",
            ResponseContentType: "application/xml",
        },
        3600,
    );

    return {
        statusCode: 302,
        headers: {
            Location: presignedUrl,
        },
        body: "",
    };
};

export const handler = streamifyResponse(async (event, responseStream) => {
    try {
        const { BUCKET_NAME: bucketName, AVL_CONSUMER_API_KEY_ARN: avlConsumerApiKeyArn } = process.env;

        if (!bucketName || !avlConsumerApiKeyArn) {
            throw new Error("Missing env vars - BUCKET_NAME and AVL_CONSUMER_API_KEY_ARN must be set");
        }

        await validateApiKey(avlConsumerApiKeyArn, event.headers);

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

            return createResponseStream(responseStream, {
                statusCode: 200,
                headers: { "Content-Type": "application/xml" },
                body: siriVm,
            });
        }

        if (downloadTfl === "true") {
            const response = await retrieveSiriVmFile(bucketName, GENERATED_SIRI_VM_TFL_FILE_PATH);
            return createResponseStream(responseStream, response);
        }

        const response = await retrieveSiriVmFile(bucketName, GENERATED_SIRI_VM_FILE_PATH);
        return createResponseStream(responseStream, response);
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn("Invalid request", e.errors);
            const response = createValidationErrorResponse(e.errors.map((error) => error.message));
            return createResponseStream(responseStream, response);
        }

        if (e instanceof InvalidApiKeyError) {
            return createResponseStream(responseStream, createUnauthorizedErrorResponse());
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the SIRI-VM downloader endpoint", e);
        }

        return createResponseStream(responseStream, createServerErrorResponse());
    }
});
