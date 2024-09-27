import { APIGatewayProxyEventHeaders, APIGatewayProxyResult } from "aws-lambda";
import { getSecret } from "./secretsManager";
import { InvalidApiKeyError } from "./validation";

export const createHttpSuccessResponse = (body?: string): APIGatewayProxyResult => {
    return {
        statusCode: 200,
        body: body ?? "",
    };
};

export const createHttpCreatedResponse = (body?: string): APIGatewayProxyResult => {
    return {
        statusCode: 201,
        body: body ?? "",
    };
};

export const createHttpNoContentResponse = (body?: string): APIGatewayProxyResult => {
    return {
        statusCode: 204,
        body: body ?? "",
    };
};

export const createHttpValidationErrorResponse = (errors: string[]): APIGatewayProxyResult => {
    return {
        statusCode: 400,
        body: JSON.stringify({ errors }),
    };
};

export const createHttpUnauthorizedErrorResponse = (error?: string): APIGatewayProxyResult => {
    return {
        statusCode: 401,
        body: JSON.stringify({ errors: [error || "Unauthorized"] }),
    };
};

export const createHttpNotFoundErrorResponse = (error: string): APIGatewayProxyResult => {
    return {
        statusCode: 404,
        body: JSON.stringify({ errors: [error] }),
    };
};

export const createHttpConflictErrorResponse = (error: string): APIGatewayProxyResult => {
    return {
        statusCode: 409,
        body: JSON.stringify({ errors: [error] }),
    };
};

export const createHttpTooManyRequestsErrorResponse = (error: string, retryAfter?: number): APIGatewayProxyResult => {
    return {
        statusCode: 429,
        headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
        body: JSON.stringify({ errors: [error] }),
    };
};

export const createHttpServerErrorResponse = (error?: string): APIGatewayProxyResult => {
    throw new Error(error || "An unexpected error occurred");
};

export const validateApiKey = async (secretArn: string, headers: APIGatewayProxyEventHeaders) => {
    const requestApiKey = headers["x-api-key"];

    if (!requestApiKey) {
        throw new InvalidApiKeyError();
    }

    const storedApiKey = await getSecret<string>({ SecretId: secretArn });

    if (requestApiKey !== storedApiKey) {
        throw new InvalidApiKeyError();
    }
};
