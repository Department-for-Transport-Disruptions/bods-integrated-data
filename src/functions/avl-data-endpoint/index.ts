import { logger } from "@baselime/lambda-logger";
import { putS3Object, getDate } from "@bods-integrated-data/shared";
import { APIGatewayEvent } from "aws-lambda";
import { parseStringPromise } from "xml2js";
import { parseBooleans } from "xml2js/lib/processors";
import parser from "fast-xml-parser";
import { randomUUID } from "crypto";

export const validateXmlAndUploadToS3 = async (xml: string, bucketName: string) => {
    const currentTime = getDate();
    const result = parser.validate(xml, {
        allowBooleanAttributes: true
    });
    console.log(result)
    if (result === true) {
        logger.info("Valid XML");

        //  TODO this needs to be sorted after AVL subscriber

        const subId = randomUUID()
        await putS3Object({
            Bucket: bucketName,
            Key: `${subId}/${currentTime.toISOString()}`,
            ContentType: "application/xml",
            Body: xml,
        });
        logger.info("Successfully uploaded SIRI-VM to S3")
    }
    else throw new Error("Not a valid XML");
};

export const handler = async (event: APIGatewayEvent) => {
    try {
        const { BUCKET_NAME: bucketName } = process.env;

        if (!bucketName) {
            throw new Error("Missing env vars - BUCKET_NAME must be set");
        }

        logger.info("Starting Data Endpoint");

        if (!event.body) {

            throw new Error("No body sent with event");
        }
        await validateXmlAndUploadToS3(event.body, bucketName);
    } catch (e) {
        if (e instanceof Error) {

            logger.error("There was a problem with the Data endpoint", e);
        }
        throw e;
    }
};