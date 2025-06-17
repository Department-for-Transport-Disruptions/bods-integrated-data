import {
    createHttpServerErrorResponse,
    createHttpUnauthorizedErrorResponse,
    createHttpValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import { getDate } from "@bods-integrated-data/shared/dates";
import { errorMapWithDataLogging, logger, withLambdaRequestTracker } from "@bods-integrated-data/shared/logger";
import {
    AvlCheckStatusRequest,
    avlCheckStatusResponseSchema,
    avlValidateRequestSchema,
} from "@bods-integrated-data/shared/schema/avl-validate.schema";
import { CompleteSiriObject } from "@bods-integrated-data/shared/utils";
import { createAuthorizationHeader } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayProxyHandler } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

z.setErrorMap(errorMapWithDataLogging);

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(avlValidateRequestSchema);

const generateCheckStatusRequestMessage = (currentTimestamp: string) => {
    const checkStatusRequestJson: AvlCheckStatusRequest = {
        Siri: {
            CheckStatusRequest: {
                RequestTimestamp: currentTimestamp,
                AccountId: "BODS",
                RequestorRef: "BODS",
            },
        },
    };

    const completeObject: CompleteSiriObject<AvlCheckStatusRequest["Siri"]> = {
        "?xml": {
            "#text": "",
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xsi:schemaLocation": "http://www.siri.org.uk/siri http://www.siri.org.uk/schema/2.0/xsd/siri.xsd",
            ...checkStatusRequestJson.Siri,
        },
    };

    const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true,
        attributeNamePrefix: "@_",
    });

    const request = builder.build(completeObject) as string;

    return request;
};

const parseXml = (xml: string) => {
    const parser = new XMLParser({
        allowBooleanAttributes: true,
        ignoreAttributes: false,
        parseTagValue: true,
    });

    const parsedXml = parser.parse(xml) as Record<string, unknown>;

    const parsedJson = avlCheckStatusResponseSchema.safeParse(parsedXml);

    if (!parsedJson.success) {
        logger.error(
            "There was an error parsing the service delivery response from the data producer.",
            parsedJson.error.format(),
        );
        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

export const handler: APIGatewayProxyHandler = async (event, context) => {
    withLambdaRequestTracker(event, context);

    try {
        const { AVL_PRODUCER_API_KEY_ARN: avlProducerApiKeyArn } = process.env;

        if (!avlProducerApiKeyArn) {
            throw new Error("Missing env var: AVL_PRODUCER_API_KEY_ARN must be set.");
        }

        await validateApiKey(avlProducerApiKeyArn, event.headers);

        const { url, username, password } = requestBodySchema.parse(event.body);

        const requestTime = getDate();
        const currentTime = requestTime.toISOString();

        const checkStatusRequest = generateCheckStatusRequestMessage(currentTime);

        const serviceDeliveryResponse = await axios.post<string>(url, checkStatusRequest, {
            headers: {
                "Content-Type": "text/xml",
                Authorization: createAuthorizationHeader(username, password),
            },
        });

        const checkStatusRequestBody = serviceDeliveryResponse.data;

        if (!checkStatusRequestBody) {
            logger.warn("No body was returned from data producer");
            return { statusCode: 200, body: JSON.stringify({ siriVersion: "Unknown" }) };
        }

        const parsedCheckStatusResponseBody = parseXml(checkStatusRequestBody);

        if (parsedCheckStatusResponseBody.Siri.CheckStatusResponse.Status !== "true") {
            logger.warn("Data producer did not return a status of true");
            return createHttpValidationErrorResponse(["Data producer did not return a status of true"]);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ siriVersion: parsedCheckStatusResponseBody.Siri["@_version"] }),
        };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.warn(e, "Invalid request");
            return createHttpValidationErrorResponse(e.errors.map((error) => error.message));
        }

        if (e instanceof InvalidApiKeyError) {
            return createHttpUnauthorizedErrorResponse();
        }

        if (e instanceof AxiosError) {
            logger.warn(e.toJSON(), "Invalid request");
            return createHttpValidationErrorResponse(["Invalid request to data producer"]);
        }

        if (e instanceof InvalidXmlError) {
            logger.warn(e, "Invalid SIRI-VM XML received from the data producer");
            return { statusCode: 200, body: JSON.stringify({ siriVersion: "Unknown" }) };
        }

        if (e instanceof Error) {
            logger.error(e, "There was a problem subscribing to the AVL feed.");
        }

        return createHttpServerErrorResponse();
    }
};
