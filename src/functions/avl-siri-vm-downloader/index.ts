import { randomUUID } from "crypto";
import { logger } from "@baselime/lambda-logger";
import {
    AGGREGATED_SIRI_VM_FILE_PATH,
    createSiriVm,
    getAvlDataForSiriVm,
} from "@bods-integrated-data/shared/avl/utils";
import { NM_TOKEN_ARRAY_REGEX, NM_TOKEN_REGEX } from "@bods-integrated-data/shared/constants";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getPresignedUrl, getS3Object } from "@bods-integrated-data/shared/s3";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

const queryParametersSchema = z.preprocess(
    (val) => Object(val),
    z.object({
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
): Promise<APIGatewayProxyResultV2> => {
    const avls = await getAvlDataForSiriVm(
        dbClient,
        boundingBox,
        operatorRef,
        vehicleRef,
        lineRef,
        producerRef,
        originRef,
        destinationRef,
    );

    const requestMessageRef = randomUUID();
    const siri = createSiriVm(avls, requestMessageRef);

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/xml" },
        body: siri,
    };
};

const retrieveSiriVmFile = async (bucketName: string, key: string) => {
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

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const { BUCKET_NAME: bucketName } = process.env;

    if (!bucketName) {
        logger.error("Missing env vars - BUCKET_NAME must be set");

        return {
            statusCode: 500,
            body: "An internal error occurred.",
        };
    }

    const parseResult = queryParametersSchema.safeParse(event.queryStringParameters);

    if (!parseResult.success) {
        const validationError = fromZodError(parseResult.error);

        return {
            statusCode: 400,
            body: validationError.message,
        };
    }

    const { boundingBox, operatorRef, vehicleRef, lineRef, producerRef, originRef, destinationRef } = parseResult.data;

    if (boundingBox || operatorRef || vehicleRef || lineRef || producerRef || originRef || destinationRef) {
        const dbClient = await getDatabaseClient(process.env.STAGE === "local");

        if (boundingBox && boundingBox.split(",").length !== 4) {
            return {
                statusCode: 400,
                body: "Bounding box must contain 4 items; minLongitude, minLatitude, maxLongitude and maxLatitude",
            };
        }

        try {
            return await retrieveSiriVmData(
                dbClient,
                boundingBox,
                operatorRef,
                vehicleRef,
                lineRef,
                producerRef,
                originRef,
                destinationRef,
            );
        } catch (error) {
            if (error instanceof Error) {
                logger.error("There was an error retrieving the SIRI-VM data", error);
            }

            return {
                statusCode: 500,
                body: "An unknown error occurred. Please try again.",
            };
        } finally {
            await dbClient.destroy();
        }
    }

    return retrieveSiriVmFile(bucketName, AGGREGATED_SIRI_VM_FILE_PATH);
};
