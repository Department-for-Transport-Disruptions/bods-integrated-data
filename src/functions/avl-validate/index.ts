import {
    createServerErrorResponse,
    createUnauthorizedErrorResponse,
    createValidationErrorResponse,
    validateApiKey,
} from "@bods-integrated-data/shared/api";
import { getDate } from "@bods-integrated-data/shared/dates";
import { logger } from "@bods-integrated-data/shared/logger";
import {
    AvlServiceRequest,
    avlServiceDeliverySchema,
    avlValidateRequestSchema,
} from "@bods-integrated-data/shared/schema/avl-validate.schema";
import { createAuthorizationHeader } from "@bods-integrated-data/shared/utils";
import { InvalidApiKeyError, InvalidXmlError } from "@bods-integrated-data/shared/validation";
import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { ZodError, z } from "zod";

const requestBodySchema = z
    .string({
        required_error: "Body is required",
        invalid_type_error: "Body must be a string",
    })
    .transform((body) => JSON.parse(body))
    .pipe(avlValidateRequestSchema);

const generateServiceRequestMessage = (currentTimestamp: string) => {
    const serviceRequestJson: AvlServiceRequest = {
        ServiceRequest: {
            RequestTimestamp: currentTimestamp,
            RequestorRef: "BODS",
            VehicleMonitoringRequest: {
                VehicleMonitoringRequest: {
                    RequestTimestamp: currentTimestamp,
                },
            },
        },
    };

    const completeObject = {
        "?xml": {
            "#text": "",
            "@_version": "1.0",
            "@_encoding": "UTF-8",
            "@_standalone": "yes",
        },
        Siri: {
            "@_version": "2.0",
            "@_xmlns": "http://www.siri.org.uk/siri",
            "@_xmlns:ns2": "http://www.ifopt.org.uk/acsb",
            "@_xmlns:ns3": "http://www.ifopt.org.uk/ifopt",
            "@_xmlns:ns4": "http://datex2.eu/schema/2_0RC1/2_0",
            ...serviceRequestJson,
        },
    };

    // @ts-ignore
    completeObject.Siri.ServiceRequest.VehicleMonitoringRequest.VehicleMonitoringRequest["@_version"] = "2.0";

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

    const parsedJson = avlServiceDeliverySchema.safeParse(parsedXml.Siri);

    if (!parsedJson.success) {
        logger.error(
            "There was an error parsing the service delivery response from the data producer.",
            parsedJson.error.format(),
        );
        throw new InvalidXmlError();
    }

    return parsedJson.data;
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { AVL_PRODUCER_API_KEY_ARN: avlProducerApiKeyArn } = process.env;

        if (!avlProducerApiKeyArn) {
            throw new Error("Missing env var: AVL_PRODUCER_API_KEY_ARN must be set.");
        }

        await validateApiKey(avlProducerApiKeyArn, event.headers);

        const { url, username, password } = requestBodySchema.parse(event.body);

        const requestTime = getDate();
        const currentTime = requestTime.toISOString();

        const serviceRequest = generateServiceRequestMessage(currentTime);

        const serviceDeliveryResponse = await axios.post<string>(url, serviceRequest, {
            headers: {
                "Content-Type": "text/xml",
                Authorization: createAuthorizationHeader(username, password),
            },
        });

        const serviceDeliveryBody = serviceDeliveryResponse.data;

        if (!serviceDeliveryBody) {
            logger.warn("No body was returned from data producer");
            return createValidationErrorResponse(["No body was returned from the data producer"]);
        }

        const parsedServiceDeliveryBody = parseXml(serviceDeliveryBody);

        if (parsedServiceDeliveryBody?.ServiceDelivery.Status !== "true") {
            logger.warn("Data producer did not return a status of true");
            return createValidationErrorResponse(["Data producer did not return a status of true"]);
        }

        return { statusCode: 200, body: JSON.stringify({ siriVersion: parsedServiceDeliveryBody["@_version"] }) };
    } catch (error) {
        if (error instanceof ZodError) {
            logger.warn("Invalid request", error);
            return createValidationErrorResponse(error.errors.map((error) => error.message));
        }

        if (error instanceof InvalidApiKeyError) {
            return createUnauthorizedErrorResponse();
        }

        if (error instanceof AxiosError) {
            logger.warn("Invalid request", error);
            return createValidationErrorResponse(["Invalid request to data producer"]);
        }

        if (error instanceof InvalidXmlError) {
            logger.warn("Invalid SIRI-VM XML received from the data producer", error);
            return createValidationErrorResponse(["Invalid SIRI-VM XML received from the data producer"]);
        }

        if (error instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", error);
        }

        return createServerErrorResponse();
    }
};
