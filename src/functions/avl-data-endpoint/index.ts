import { logger } from "@baselime/lambda-logger";
import { putS3Object, getDate } from "@bods-integrated-data/shared";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { XMLValidator } from "fast-xml-parser";
import { ClientError } from "./errors";

export const validateXmlAndUploadToS3 = async (xml: string, bucketName: string, subscriptionId: string) => {
    const currentTime = getDate();
    const result = XMLValidator.validate(xml, {
        allowBooleanAttributes: true,
    });
    if (result !== true) {
        throw new ClientError();
    }
    logger.info("Valid XML");
    await putS3Object({
        Bucket: bucketName,
        Key: `${subscriptionId}/${currentTime.toISOString()}`,
        ContentType: "application/xml",
        Body: xml,
    });
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        const subscriptionId = event?.pathParameters?.subscriptionId;

        if (!subscriptionId) {
            throw new Error("Subscription ID missing from path parameters.");
        }

        logger.info("Starting Data Endpoint");

        if (!event.body) {
            throw new Error("No body sent with event");
        }
        await validateXmlAndUploadToS3(event.body, bucketName, subscriptionId);

        logger.info("Successfully uploaded SIRI-VM to S3");

        return {
            statusCode: 200,
        };
    } catch (e) {
        if (e instanceof ClientError) {
            logger.warn("Invalid XML provided.", e);
            return { statusCode: 400 };
        }

        if (e instanceof Error) {
            logger.error("There was a problem with the Data endpoint", e);
        }

        throw e;
    }
};
