import { logger } from "@baselime/lambda-logger";
import { createAuthorizationHeader } from "@bods-integrated-data/shared/avl/utils";
import { APIGatewayEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import axios, { AxiosError } from "axios";
import { ZodError, z } from "zod";

export type SubscriptionValidationStatus = "FEED_VALID" | "FEED_INVALID";

export const avlValidateRequestSchema = z.object({
    url: z.string().url(),
    username: z.string(),
    password: z.string(),
});

export const createApiResponse = (
    statusCode: number,
    status: SubscriptionValidationStatus,
): APIGatewayProxyResultV2 => {
    return {
        statusCode,
        body: JSON.stringify({ status }),
    };
};

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
    try {
        const { url, username, password } = avlValidateRequestSchema.parse(event.body);

        const validateMessage = ""; // todo: determine validation mechanism

        await axios.post<string>(url, validateMessage, {
            headers: {
                "Content-Type": "text/xml",
                Authorization: createAuthorizationHeader(username, password),
            },
        });

        return createApiResponse(200, "FEED_VALID");
    } catch (error) {
        if (error instanceof AxiosError || error instanceof ZodError) {
            logger.error("Invalid request", error);

            return createApiResponse(400, "FEED_INVALID");
        }

        if (error instanceof Error) {
            logger.error("There was a problem subscribing to the AVL feed.", error);
        }

        return createApiResponse(500, "FEED_INVALID");
    }
};
