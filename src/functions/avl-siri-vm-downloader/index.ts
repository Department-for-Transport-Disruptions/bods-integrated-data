import { randomUUID } from "node:crypto";
import {} from "node:stream";
import { logger } from "@baselime/lambda-logger";
import {
    GENERATED_SIRI_VM_FILE_PATH,
    GENERATED_SIRI_VM_TFL_FILE_PATH,
    createSiriVm,
    getAvlDataForSiriVm,
} from "@bods-integrated-data/shared/avl/utils";
import { NM_TOKEN_ARRAY_REGEX, NM_TOKEN_REGEX } from "@bods-integrated-data/shared/constants";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { getPresignedUrl } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { createResponseStream, streamifyResponse } from "./utils";

const queryParametersSchema = z.preprocess(
    (val) => Object(val),
    z.object({
        downloadTfl: z.coerce.string().toLowerCase().optional(),
        boundingBox: z.coerce
            .string()
            .regex(/^[-]?[0-9]+(\.[0-9]+)?(,[-]?[0-9]+(\.[0-9]+)?)*$/)
            .optional(),
        operatorRef: z.coerce.string().regex(NM_TOKEN_ARRAY_REGEX).optional(),
        vehicleRef: z.coerce.string().regex(NM_TOKEN_REGEX).optional(),
        lineRef: z.coerce.string().regex(NM_TOKEN_REGEX).optional(),
        producerRef: z.coerce.string().regex(NM_TOKEN_REGEX).optional(),
        originRef: z.coerce.string().regex(NM_TOKEN_REGEX).optional(),
        destinationRef: z.coerce.string().regex(NM_TOKEN_REGEX).optional(),
        subscriptionId: z.coerce.string().optional(),
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

const retrieveSiriVmFile = async (bucketName: string, key: string): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
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
        };
    } catch (error) {
        if (error instanceof Error) {
            logger.error(`There was an error retrieving SIRI-VM data with key: ${key}`, error);
        }

        return {
            statusCode: 500,
            body: "An unknown error occurred. Please try again.",
        };
    }
};

export const handler = streamifyResponse(async (event, responseStream) => {
    const { BUCKET_NAME: bucketName } = process.env;

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return createResponseStream(responseStream, {
            statusCode: 500,
            body: "An internal error occurred.",
        });
    }

    const parseResult = queryParametersSchema.safeParse(event.queryStringParameters);

    if (!parseResult.success) {
        const validationError = fromZodError(parseResult.error);

        return createResponseStream(responseStream, {
            statusCode: 400,
            body: validationError.message,
        });
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
    } = parseResult.data;

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

        if (boundingBox && boundingBox.split(",").length !== 4) {
            return createResponseStream(responseStream, {
                statusCode: 400,
                body: "Bounding box must contain 4 items; minLongitude, minLatitude, maxLongitude and maxLatitude",
            });
        }

        try {
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
        } catch (error) {
            if (error instanceof Error) {
                logger.error("There was an error retrieving the SIRI-VM data", error);
            }

            return createResponseStream(responseStream, {
                statusCode: 500,
                body: "An unknown error occurred. Please try again.",
            });
        } finally {
            await dbClient.destroy();
        }
    }

    if (downloadTfl === "true") {
        const response = await retrieveSiriVmFile(bucketName, GENERATED_SIRI_VM_TFL_FILE_PATH);
        return createResponseStream(responseStream, response);
    }

    const response = await retrieveSiriVmFile(bucketName, GENERATED_SIRI_VM_FILE_PATH);
    return createResponseStream(responseStream, response);
});
