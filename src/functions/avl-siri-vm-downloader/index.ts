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
    createVehicleActivities,
    getAvlDataForSiriVm,
} from "@bods-integrated-data/shared/avl/utils";
import { KyselyDb, getDatabaseClient } from "@bods-integrated-data/shared/database";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import { getS3Object } from "@bods-integrated-data/shared/s3";
import {
    InvalidApiKeyError,
    createBoundingBoxValidation,
    createNmTokenArrayValidation,
    createNmTokenValidation,
    createStringLengthValidation,
} from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { ZodError, z } from "zod";

let dbClient: KyselyDb;

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
    boundingBox?: number[],
    operatorRef?: string[],
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
    const vehicleActivities = createVehicleActivities(avls, responseTime);

    return createSiriVm(vehicleActivities, requestMessageRef, responseTime);
};

const retrieveSiriVmFile = async (bucketName: string, key: string): Promise<string> => {
    const object = await getS3Object({
        Bucket: bucketName,
        Key: key,
        ResponseContentType: "application/xml",
    });

    return object.Body?.transformToString() || "";
};

export const handler: APIGatewayProxyHandler = async (event, context): Promise<APIGatewayProxyResult> => {
    withLambdaRequestTracker(event ?? {}, context ?? {});

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

        logger.info(`Invoking SIRI-VM Downloader, query params: ${JSON.stringify(event.queryStringParameters)}`);

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
            !boundingBox &&
            (!operatorRef || (operatorRef.includes("TFLO") && operatorRef.length === 1)) &&
            !vehicleRef &&
            !lineRef &&
            !producerRef &&
            !originRef &&
            !destinationRef &&
            !subscriptionId
        ) {
            siriVm = await retrieveSiriVmFile(
                bucketName,
                downloadTfl === "true" || (operatorRef?.includes("TFLO") && operatorRef?.length === 1)
                    ? GENERATED_SIRI_VM_TFL_FILE_PATH
                    : GENERATED_SIRI_VM_FILE_PATH,
            );
        } else {
            dbClient = dbClient || (await getDatabaseClient(process.env.STAGE === "local"));

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
            logger.warn(`Invalid request: ${JSON.stringify(event.queryStringParameters)}`);
            logger.warn(e);
            return createValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            return createUnauthorizedErrorResponse();
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem with the SIRI-VM downloader endpoint");
        }

        return createServerErrorResponse();
    }
};

process.on("SIGTERM", async () => {
    if (dbClient) {
        logger.info("Destroying DB client...");
        await dbClient.destroy();
    }

    process.exit(0);
});
